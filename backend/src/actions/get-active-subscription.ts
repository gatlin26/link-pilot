'use server';

import { websiteConfig } from '@/config/website';
import type { User } from '@/lib/auth-types';
import { userActionClient } from '@/lib/safe-action';
import { getSubscriptions } from '@/payment';
import { z } from 'zod';

// Input schema
const schema = z.object({
  userId: z.string().min(1, { error: 'User ID is required' }),
});

/**
 * Get active subscription data
 *
 * If the user has multiple subscriptions,
 * it returns the most recent active or trialing one
 */
export const getActiveSubscriptionAction = userActionClient
  .schema(schema)
  .action(async ({ ctx }) => {
    const currentUser = (ctx as { user: User }).user;

    // IMPORTANT:
    // This action is provider-agnostic, so we must NOT hardcode Stripe env checks here.
    // Otherwise Creem users will always appear as "free plan" even if payments/webhooks succeeded.
    const provider = websiteConfig.payment.provider;
    if (provider === 'stripe') {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!stripeSecretKey || !stripeWebhookSecret) {
        console.log('Stripe environment variables not configured, return');
        return { success: true, data: null };
      }
    } else if (provider === 'creem') {
      const creemApiKey = process.env.CREEM_API_KEY;
      const creemWebhookSecret = process.env.CREEM_WEBHOOK_SECRET;

      // NOTE: CreemProvider constructor currently requires both.
      if (!creemApiKey || !creemWebhookSecret) {
        console.log('Creem environment variables not configured, return');
        return { success: true, data: null };
      }
    } else {
      return {
        success: false,
        error: `Unsupported payment provider: ${provider}`,
      };
    }

    try {
      // Find the user's most recent active subscription
      const subscriptions = await getSubscriptions({
        userId: currentUser.id,
      });
      // console.log('get user subscriptions:', subscriptions);

      let subscriptionData = null;
      // Find the most recent active subscription (if any)
      if (subscriptions && subscriptions.length > 0) {
        // First try to find an active subscription
        const activeSubscription = subscriptions.find(
          (sub) => sub.status === 'active' || sub.status === 'trialing'
        );

        // If found, use it
        if (activeSubscription) {
          console.log('find active subscription for userId:', currentUser.id);
          subscriptionData = activeSubscription;
        } else {
          console.log(
            'no active subscription found for userId:',
            currentUser.id
          );
        }
      } else {
        console.log('no subscriptions found for userId:', currentUser.id);
      }

      return {
        success: true,
        data: subscriptionData,
      };
    } catch (error) {
      console.error('get user subscription data error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
