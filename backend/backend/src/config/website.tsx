import { PaymentTypes, PlanIntervals } from '@/payment/types';
import type { WebsiteConfig } from '@/types';

/**
 * website config, without translations
 *
 * docs:
 * https://mksaas.com/docs/config/website
 */
export const websiteConfig: WebsiteConfig = {
  ui: {
    theme: {
      defaultTheme: 'default',
      enableSwitch: true,
    },
    mode: {
      defaultMode: 'light', // 默认使用亮色主题
      enableSwitch: true,
    },
  },
  metadata: {
    name: 'BuildWay',
    description:
      'Discover and explore the best AI tools for every need. Your ultimate AI tools directory with curated collections, reviews, and recommendations.',
    foundingDate: '2024',
    supportEmail: 'support@buildway.cc',
    images: {
      ogImage: '/og.png',
      logoLight: '/logo.png',
      logoDark: '/logo-dark.png',
    },
    social: {
      twitter: 'https://twitter.com/buildway',
      github: 'https://github.com/buildway',
    },
  },
  features: {
    enableUpgradeCard: true,
    enableUpdateAvatar: true,
    enableAffonsoAffiliate: false,
    enablePromotekitAffiliate: false,
    enableDatafastRevenueTrack: false,
    enableCrispChat: process.env.NEXT_PUBLIC_DEMO_WEBSITE === 'true',
    enableTurnstileCaptcha: process.env.NEXT_PUBLIC_DEMO_WEBSITE === 'true',
  },
  routes: {
    defaultLoginRedirect: '/',
  },
  analytics: {
    enableVercelAnalytics: false,
    enableSpeedInsights: false,
  },
  auth: {
    enableGoogleLogin: true,
    enableGithubLogin: false,
    enableCredentialLogin: false, // 禁用邮箱注册，只支持 Google 登录
  },
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: {
        flag: '🇺🇸',
        name: 'English',
      },
      zh: {
        flag: '🇨🇳',
        name: '中文',
      },
      'zh-TW': {
        flag: '🇹🇼',
        name: '繁體中文',
      },
      ko: {
        flag: '🇰🇷',
        name: '한국어',
      },
      ja: {
        flag: '🇯🇵',
        name: '日本語',
      },
      pt: {
        flag: '🇧🇷',
        name: 'Português',
      },
      es: {
        flag: '🇪🇸',
        name: 'Español',
      },
      de: {
        flag: '🇩🇪',
        name: 'Deutsch',
      },
      fr: {
        flag: '🇫🇷',
        name: 'Français',
      },
      vi: {
        flag: '🇻🇳',
        name: 'Tiếng Việt',
      },
    },
  },
  blog: {
    enable: true,
    paginationSize: 6,
    relatedPostsSize: 3,
  },
  docs: {
    enable: false,
  },
  mail: {
    provider: 'resend',
    fromEmail: 'BuildWay <support@buildway.cc>',
    supportEmail: 'BuildWay <support@buildway.cc>',
  },
  newsletter: {
    enable: true,
    provider: 'resend',
    autoSubscribeAfterSignUp: true,
  },
  storage: {
    enable: true,
    provider: 's3',
  },
  payment: {
    provider:
      (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER as 'stripe' | 'creem') ||
      'creem', // 默认使用 Creem
  },
  price: {
    plans: {
      // 只保留 free plan
      free: {
        id: 'free',
        prices: [],
        isFree: true,
        isLifetime: false,
        credits: {
          enable: false,
          amount: 0,
          expireDays: 30,
        },
      },
    },
  },
  credits: {
    // 禁用积分系统
    enableCredits: false,
    enablePackagesForFreePlan: false,
    registerGiftCredits: {
      enable: false,
      amount: 0,
      expireDays: 0,
    },
    freePool: {
      enable: false,
      maxDailyCredits: 0,
      maxUserDailyCredits: 0,
      maxCreditsPerModel: 0,
    },
    packages: {
      starter: {
        id: 'starter',
        popular: false,
        amount: 0,
        expireDays: 0,
        price: {
          priceId: '',
          amount: 0,
          currency: 'USD',
          allowPromotionCode: false,
        },
      },
      popular: {
        id: 'popular',
        popular: false,
        amount: 0,
        expireDays: 0,
        price: {
          priceId: '',
          amount: 0,
          currency: 'USD',
          allowPromotionCode: false,
        },
      },
      pro: {
        id: 'pro',
        popular: false,
        amount: 0,
        expireDays: 0,
        price: {
          priceId: '',
          amount: 0,
          currency: 'USD',
          allowPromotionCode: false,
        },
      },
    },
  },
};
