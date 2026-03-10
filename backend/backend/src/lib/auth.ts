import { websiteConfig } from '@/config/website';
import {
  addMonthlyFreeCredits,
  addRegisterGiftCredits,
} from '@/credits/credits';
import { getDb } from '@/db/index';
import { defaultMessages } from '@/i18n/messages';
import { LOCALE_COOKIE_NAME, routing } from '@/i18n/routing';
import { sendEmail } from '@/mail';
import { subscribe } from '@/newsletter';
import { type User, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { parse as parseCookies } from 'cookie';
import type { Locale } from 'next-intl';
import { downloadAndCacheAvatar } from './avatar-cache';
import { getAllPricePlans } from './price-plan';
import { getBaseUrl, getUrlWithLocaleInCallbackUrl } from './urls/urls';

/**
 * Better Auth configuration
 *
 * docs:
 * https://mksaas.com/docs/auth
 * https://www.better-auth.com/docs/reference/options
 */
export const auth = betterAuth({
  baseURL: getBaseUrl(),
  appName: defaultMessages.Metadata.name,
  database: drizzleAdapter(await getDb(), {
    provider: 'pg', // or "mysql", "sqlite"
  }),
  session: {
    // https://www.better-auth.com/docs/concepts/session-management#cookie-cache
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60, // Cache duration in seconds
    },
    // https://www.better-auth.com/docs/concepts/session-management#session-expiration
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // https://www.better-auth.com/docs/concepts/session-management#session-freshness
    // https://www.better-auth.com/docs/concepts/users-accounts#authentication-requirements
    // disable freshness check for user deletion
    freshAge: 0 /* 60 * 60 * 24 */,
  },
  emailAndPassword: {
    enabled: false, // 禁用邮箱注册，只支持 Google 登录
    // https://www.better-auth.com/docs/concepts/email#2-require-email-verification
    requireEmailVerification: true,
    // https://www.better-auth.com/docs/authentication/email-password#forget-password
    async sendResetPassword({ user, url }, request) {
      const locale = getLocaleFromRequest(request);
      const localizedUrl = getUrlWithLocaleInCallbackUrl(url, locale);

      await sendEmail({
        to: user.email,
        template: 'forgotPassword',
        context: {
          url: localizedUrl,
          name: user.name,
        },
        locale,
      });
    },
  },
  emailVerification: {
    // https://www.better-auth.com/docs/concepts/email#auto-signin-after-verification
    autoSignInAfterVerification: true,
    // https://www.better-auth.com/docs/authentication/email-password#require-email-verification
    sendVerificationEmail: async ({ user, url, token }, request) => {
      const locale = getLocaleFromRequest(request);
      const localizedUrl = getUrlWithLocaleInCallbackUrl(url, locale);

      await sendEmail({
        to: user.email,
        template: 'verifyEmail',
        context: {
          url: localizedUrl,
          name: user.name,
        },
        locale,
      });
    },
  },
  socialProviders: {
    // https://www.better-auth.com/docs/authentication/google
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    // https://www.better-auth.com/docs/authentication/github
    // Disabled for now
    // github: {
    //   clientId: process.env.GITHUB_CLIENT_ID!,
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    // },
  },
  account: {
    // https://www.better-auth.com/docs/concepts/users-accounts#account-linking
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  user: {
    // https://www.better-auth.com/docs/concepts/database#extending-core-schema
    additionalFields: {
      customerId: {
        type: 'string',
        required: false,
      },
      role: {
        type: 'string',
        required: false,
      },
    },
    // https://www.better-auth.com/docs/concepts/users-accounts#delete-user
    deleteUser: {
      enabled: true,
    },
  },
  databaseHooks: {
    // https://www.better-auth.com/docs/concepts/database#database-hooks
    user: {
      create: {
        after: async (user) => {
          await onCreateUser(user);
        },
      },
      update: {
        before: async (user) => {
          // 防御：user 可能为 undefined（better-auth #5771 在旧版本中的 bug）
          if (!user) {
            return;
          }
          // Only process if image field is being updated
          if (!user.image) {
            return;
          }
          // `before` hook receives a partial user object; id may be missing.
          if (!user.id) {
            return;
          }

          const publicUrl = process.env.STORAGE_PUBLIC_URL;

          // Skip caching if the new image is already using our R2 storage
          if (publicUrl && user.image.includes(publicUrl)) {
            console.log(
              `Avatar already using R2 storage, skipping cache for user ${user.id}`
            );
            return;
          }

          // Check if user already has a cached avatar in database
          // If so, don't overwrite with external URL (e.g., Google avatar changes)
          try {
            const db = await getDb();
            const { eq } = await import('drizzle-orm');
            const { user: userTable } = await import('@/db/schema');
            const existingRows = await db
              .select({ image: userTable.image })
              .from(userTable)
              .where(eq(userTable.id, user.id))
              .limit(1);
            const existingUser = existingRows[0];

            // If user already has an R2 avatar, keep it and ignore the external URL update
            if (
              existingUser?.image &&
              publicUrl &&
              existingUser.image.includes(publicUrl)
            ) {
              console.log(
                `User ${user.id} already has R2 avatar, ignoring external URL update`
              );
              // Keep existing R2 avatar
              // better-auth 数据库 hook 的 `before` 需要返回 `{ data }` 才能应用修改
              return { data: { image: existingUser.image } };
            }
          } catch (error) {
            console.error('Error checking existing avatar:', error);
            // Continue with update if check fails
          }

          // Cache avatar from external URL (Google, GitHub, etc.)
          // This only happens if user doesn't have an R2 avatar yet
          try {
            const cachedUrl = await downloadAndCacheAvatar(user.image, user.id);
            if (cachedUrl !== user.image) {
              console.log(
                `Avatar cached from external URL for user ${user.id}`
              );
              return { data: { image: cachedUrl } };
            }
          } catch (error) {
            console.error('Avatar caching error on update:', error);
            // Continue with update even if caching fails
          }
          return;
        },
      },
    },
  },
  plugins: [
    // https://www.better-auth.com/docs/plugins/admin
    // support user management, ban/unban user, manage user roles, etc.
    admin({
      // https://www.better-auth.com/docs/plugins/admin#default-ban-reason
      // defaultBanReason: 'Spamming',
      defaultBanExpiresIn: undefined,
      bannedUserMessage:
        'You have been banned from this application. Please contact support if you believe this is an error.',
    }),
  ],
  onAPIError: {
    // https://www.better-auth.com/docs/reference/options#onapierror
    errorURL: '/auth/error',
    onError: (error, ctx) => {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('auth error:', {
        message: err.message,
        stack: err.stack,
        path: ctx?.path,
      });
    },
  },
});

/**
 * Gets the locale from a request by parsing the cookies
 * If no locale is found in the cookies, returns the default locale
 *
 * @param request - The request to get the locale from
 * @returns The locale from the request or the default locale
 */
export function getLocaleFromRequest(request?: Request): Locale {
  const cookies = parseCookies(request?.headers.get('cookie') ?? '');
  return (cookies[LOCALE_COOKIE_NAME] as Locale) ?? routing.defaultLocale;
}

/**
 * On create user hook
 *
 * @param user - The user to create
 */
async function onCreateUser(user: User) {
  // Cache user avatar to R2 storage if available
  // This prevents 429 errors from Google/GitHub avatar URLs
  if (user.image) {
    try {
      const cachedUrl = await downloadAndCacheAvatar(user.image, user.id);
      // Update user's image URL to the cached version
      if (cachedUrl !== user.image) {
        const db = await getDb();
        await db
          .update((await import('@/db/schema')).user)
          .set({ image: cachedUrl })
          .where(
            (await import('drizzle-orm')).eq(
              (await import('@/db/schema')).user.id,
              user.id
            )
          );
        console.log(`Avatar cached for user ${user.id}`);
      }
    } catch (error) {
      console.error('Avatar caching error:', error);
      // Continue with user creation even if avatar caching fails
    }
  }

  // Auto subscribe user to newsletter after sign up if enabled in website config
  // Add a delay to avoid hitting Resend's 1 email per second limit
  if (
    user.email &&
    websiteConfig.newsletter.enable &&
    websiteConfig.newsletter.autoSubscribeAfterSignUp
  ) {
    // Delay newsletter subscription by 2 seconds to avoid rate limiting
    // This ensures the email verification email is sent first
    // Using 2 seconds instead of 1 to provide extra buffer for network delays
    setTimeout(async () => {
      try {
        const subscribed = await subscribe(user.email);
        if (!subscribed) {
          console.error(`Failed to subscribe user ${user.email} to newsletter`);
        } else {
          console.log(`User ${user.email} subscribed to newsletter`);
        }
      } catch (error) {
        console.error('Newsletter subscription error:', error);
      }
    }, 2000);
  }

  // Add register gift credits to the user if enabled in website config
  if (
    websiteConfig.credits.enableCredits &&
    websiteConfig.credits.registerGiftCredits.enable &&
    websiteConfig.credits.registerGiftCredits.amount > 0
  ) {
    try {
      await addRegisterGiftCredits(user.id);
      console.log(`added register gift credits for user ${user.id}`);
    } catch (error) {
      console.error('Register gift credits error:', error);
    }
  }

  // Add free monthly credits to the user if enabled in website config
  if (websiteConfig.credits.enableCredits) {
    const pricePlans = getAllPricePlans();
    // NOTICE: make sure the free plan is not disabled and has credits enabled
    const freePlan = pricePlans.find(
      (plan) => plan.isFree && !plan.disabled && plan.credits?.enable
    );
    if (freePlan) {
      try {
        await addMonthlyFreeCredits(user.id, freePlan.id);
        console.log(`added Free monthly credits for user ${user.id}`);
      } catch (error) {
        console.error('Free monthly credits error:', error);
      }
    }
  }
}
