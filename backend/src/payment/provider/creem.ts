import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { Creem } from 'creem';
import type { WebhookEventObject } from 'creem';
import { desc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { websiteConfig } from '@/config/website';
import {
  addCredits,
  addLifetimeMonthlyCredits,
  addSubscriptionCredits,
} from '@/credits/credits';
import { getCreditPackageById } from '@/credits/server';
import { CREDIT_TRANSACTION_TYPE } from '@/credits/types';
import { getDb } from '@/db';
import { payment, tools, user } from '@/db/schema';
import { findPlanByPriceId, findPriceInPlan } from '@/lib/price-plan';
import { sendNotification } from '@/notification/notification';

import type {
  CheckoutResult,
  CreateCheckoutParams,
  CreateCreditCheckoutParams,
  CreatePortalParams,
  PaymentProvider,
  PaymentStatus,
  PlanInterval,
  PortalResult,
  Subscription,
  getSubscriptionsParams,
} from '../types';
import { PaymentTypes, PlanIntervals } from '../types';

/**
 * 订阅记录插入数据结构
 */
interface SubscriptionInsertData {
  id: string;
  userId: string;
  customerId: string;
  type: string;
  status: PaymentStatus;
  subscriptionId: string;
  priceId: string;
  interval: PlanInterval;
  periodStart?: Date;
  periodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
  trialStart?: Date;
  trialEnd?: Date;
}

/**
 * Creem 支付提供商实现
 *
 * @author peiwen
 * @date 2025-12-20
 */
export class CreemProvider implements PaymentProvider {
  private creem: Creem;
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    const apiKey = process.env.CREEM_API_KEY;
    if (!apiKey) {
      throw new Error('CREEM_API_KEY environment variable is not set');
    }

    const webhookSecret = process.env.CREEM_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('CREEM_WEBHOOK_SECRET environment variable is not set');
    }

    const isTestMode = apiKey.startsWith('creem_test_');
    this.creem = new Creem({
      serverIdx: isTestMode ? 1 : 0,
    });

    console.log('[Creem] Initialized:', {
      mode: isTestMode ? 'TEST' : 'PRODUCTION',
      apiKeyPrefix: apiKey.substring(0, 15),
      webhookSecretPrefix: webhookSecret.substring(0, 10),
      webhookSecretLength: webhookSecret.length,
    });

    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
  }

  // ========== 实现 PaymentProvider 接口（5 个方法）==========

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const { planId, priceId, customerEmail, successUrl, metadata } = params;

    try {
      console.log('[Creem] Creating checkout session:', {
        planId,
        priceId,
        customerEmail,
      });

      if (!priceId || priceId === '') {
        throw new Error(
          `Invalid priceId: ${priceId}. Please check your NEXT_PUBLIC_CREEM_PRODUCT_* settings.`
        );
      }

      const result = await this.creem.createCheckout({
        xApiKey: this.apiKey,
        createCheckoutRequest: {
          productId: priceId,
          requestId: metadata?.userId || randomUUID(),
          successUrl:
            successUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
          metadata: {
            ...metadata,
            planId,
            email: customerEmail,
          },
        },
      });

      if (!result?.checkoutUrl) {
        throw new Error(
          `Creem SDK did not return a valid checkout URL. Please verify your API key and product ID (${priceId}).`
        );
      }

      console.log('[Creem] Checkout session created:', result.id);

      return {
        url: result.checkoutUrl,
        id: result.id || '',
      };
    } catch (error) {
      console.error('[Creem] createCheckout error:', error);
      throw error;
    }
  }

  async createCreditCheckout(
    params: CreateCreditCheckoutParams
  ): Promise<CheckoutResult> {
    const { packageId, priceId, customerEmail, successUrl, metadata } = params;

    try {
      console.log('[Creem] Creating credit checkout:', { packageId, priceId });

      if (!priceId || priceId === '') {
        throw new Error(
          `Invalid priceId for credit package: ${priceId}. Please check your NEXT_PUBLIC_CREEM_PRODUCT_CREDITS_* settings.`
        );
      }

      const result = await this.creem.createCheckout({
        xApiKey: this.apiKey,
        createCheckoutRequest: {
          productId: priceId,
          requestId: metadata?.userId || randomUUID(),
          successUrl:
            successUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/credits`,
          metadata: {
            ...metadata,
            packageId,
            email: customerEmail,
            isCreditPurchase: 'true',
          },
        },
      });

      if (!result?.checkoutUrl) {
        throw new Error(
          'Creem SDK did not return a valid checkout URL for credit package.'
        );
      }

      console.log('[Creem] Credit checkout created');

      return {
        url: result.checkoutUrl,
        id: result.id || '',
      };
    } catch (error) {
      console.error('[Creem] createCreditCheckout error:', error);
      throw error;
    }
  }

  async createCustomerPortal(
    params: CreatePortalParams
  ): Promise<PortalResult> {
    const { customerId } = params;

    try {
      console.log('[Creem] Creating customer portal for:', customerId);

      const result = await this.creem.generateCustomerLinks({
        xApiKey: this.apiKey,
        createCustomerPortalLinkRequestEntity: {
          customerId,
        },
      });

      console.log('[Creem] Customer portal link generated');

      return {
        url: result.customerPortalLink,
      };
    } catch (error) {
      console.error('[Creem] createCustomerPortal error:', error);
      throw error;
    }
  }

  async getSubscriptions(
    params: getSubscriptionsParams
  ): Promise<Subscription[]> {
    const { userId } = params;

    try {
      const db = await getDb();
      const userRecords = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const userRecord = userRecords[0];

      if (!userRecord?.customerId) {
        return [];
      }

      const payments = await db
        .select()
        .from(payment)
        .where(eq(payment.customerId, userRecord.customerId))
        .orderBy(desc(payment.createdAt));

      return payments
        .filter((p) => p.type === PaymentTypes.SUBSCRIPTION)
        .map((p) => ({
          id: p.subscriptionId || p.id,
          customerId: p.customerId,
          status: p.status as PaymentStatus,
          priceId: p.priceId,
          type: PaymentTypes.SUBSCRIPTION,
          interval: p.interval as PlanInterval | undefined,
          currentPeriodStart: p.periodStart || undefined,
          currentPeriodEnd: p.periodEnd || undefined,
          cancelAtPeriodEnd: p.cancelAtPeriodEnd || false,
          trialStartDate: p.trialStart || undefined,
          trialEndDate: p.trialEnd || undefined,
          createdAt: p.createdAt,
        }));
    } catch (error) {
      console.error('[Creem] getSubscriptions error:', error);
      throw error;
    }
  }

  async handleWebhookEvent(payload: string, signature: string): Promise<void> {
    try {
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      const event = JSON.parse(payload) as {
        eventType: string;
        object: WebhookEventObject;
      };
      const eventType = event.eventType;
      console.log(`[Creem] Handle webhook event: ${eventType}`);

      if (eventType.startsWith('checkout.')) {
        if (eventType === 'checkout.completed') {
          await this.handleCheckoutCompleted(event.object);
        }
      } else if (eventType.startsWith('subscription.')) {
        const subscriptionData = event.object;

        switch (eventType) {
          case 'subscription.paid':
            await this.onUpdateSubscription(subscriptionData, 'paid');
            break;
          case 'subscription.update':
            await this.onUpdateSubscription(subscriptionData, 'update');
            break;
          case 'subscription.trialing':
            await this.onUpdateSubscription(subscriptionData, 'trialing');
            break;
          case 'subscription.paused':
            await this.onUpdateSubscription(subscriptionData, 'paused');
            break;
          case 'subscription.canceled':
            await this.onDeleteSubscription(subscriptionData);
            break;
          case 'subscription.expired':
            await this.onDeleteSubscription(subscriptionData);
            break;
          case 'subscription.active':
            console.log(
              '[Creem] Subscription active (sync only):',
              subscriptionData.id
            );
            break;
        }
      } else if (eventType === 'refund.created') {
        await this.onRefundCreated(event.object);
      } else if (eventType === 'dispute.created') {
        await this.onDisputeCreated(event.object);
      }
    } catch (error) {
      console.error('[Creem] handleWebhookEvent error:', error);
      throw new Error('Failed to handle webhook event');
    }
  }

  // ========== 私有方法（完全类型安全）==========

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    // 尝试使用完整的 secret
    const computedSignature1 = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    // 尝试去掉 whsec_ 前缀
    const secretWithoutPrefix = this.webhookSecret.replace(/^whsec_/, '');
    const computedSignature2 = crypto
      .createHmac('sha256', secretWithoutPrefix)
      .update(payload)
      .digest('hex');

    console.log('[Creem] Signature verification:', {
      receivedSignature: signature,
      computedWithFullSecret: computedSignature1,
      computedWithoutPrefix: computedSignature2,
      secretLength: this.webhookSecret.length,
      secretPrefix: this.webhookSecret.substring(0, 10),
    });

    return computedSignature1 === signature || computedSignature2 === signature;
  }

  private async handleCheckoutCompleted(
    data: WebhookEventObject
  ): Promise<void> {
    const { product, subscription, metadata } = data;
    const isCreditPurchase = metadata?.isCreditPurchase === 'true';
    const isToolSubmitPro = metadata?.type === 'tool_submit_pro';

    if (isToolSubmitPro) {
      await this.onToolSubmitProPurchase(data);
    } else if (isCreditPurchase) {
      await this.onCreditPurchase(data);
    } else if (product?.billing_type === 'recurring' && subscription) {
      await this.onCreateSubscription(data);
    } else {
      await this.onOnetimePayment(data);
    }
  }

  private async onCreateSubscription(data: WebhookEventObject): Promise<void> {
    console.log('[Creem] >> Create subscription payment record');
    const { order, product, subscription, customer, metadata } = data;

    const userIdFromMetadata = metadata?.userId;
    const customerId = customer.id;
    const productId = product?.id;
    const subscriptionId = subscription?.id;

    if (!subscriptionId || !productId) {
      console.warn('[Creem] No subscription/product ID found in checkout data');
      return;
    }

    try {
      const db = await getDb();
      const existingSubscription = await db
        .select({ id: payment.id })
        .from(payment)
        .where(eq(payment.subscriptionId, subscriptionId))
        .limit(1);

      if (existingSubscription.length > 0) {
        console.log('[Creem] Subscription already created:', subscriptionId);
        // IMPORTANT:
        // Webhooks can be delivered multiple times (retries / duplicates).
        // If we `return` here, we will never reach credit granting.
        // That makes the system fragile: a transient failure between "insert payment" and
        // "grant credits" would permanently leave the user with a subscription but no credits.
        //
        // We intentionally continue:
        // - `createOrUpdateSubscriptionRecord` will update the record
        // - `addSubscriptionCredits` has its own monthly gating (canAddCreditsByType)
      }

      await this.updateUserWithCustomerId(customerId, customer.email);

      // IMPORTANT:
      // Creem webhook payloads may omit `metadata` in some events.
      // We still can resolve the user via `customerId` (after we wrote customerId to user record).
      const resolvedUserId =
        userIdFromMetadata || (await this.findUserIdByCustomerId(customerId));

      await this.createOrUpdateSubscriptionRecord(
        resolvedUserId,
        customerId,
        productId,
        data,
        'checkout.completed'
      );

      if (websiteConfig.credits?.enableCredits && resolvedUserId) {
        await addSubscriptionCredits(resolvedUserId, productId);
        console.log('[Creem] << Added subscription credits for user');
      } else if (websiteConfig.credits?.enableCredits && !resolvedUserId) {
        console.warn(
          '[Creem] Credits enabled, but cannot resolve userId for subscription:',
          { subscriptionId, customerId }
        );
      }

      if (order) {
        await sendNotification(
          order.id,
          customerId,
          resolvedUserId || 'unknown',
          order.total_amount / 100
        );
      }

      console.log('[Creem] << Created subscription payment record');
    } catch (error) {
      console.error(
        '[Creem] onCreateSubscription error for subscription:',
        subscriptionId,
        error
      );
      throw error;
    }
  }

  private async onOnetimePayment(data: WebhookEventObject): Promise<void> {
    console.log('[Creem] >> Handle one-time payment');
    const { order, product, customer, metadata } = data;

    const userIdFromMetadata = metadata?.userId;
    const customerId = customer.id;
    const productId = product?.id;
    const orderId = order?.id;

    if (!productId || !orderId) {
      console.warn('[Creem] No product/order ID found');
      return;
    }

    try {
      const db = await getDb();
      const existingPayment = await db
        .select({ id: payment.id })
        .from(payment)
        .where(eq(payment.sessionId, orderId))
        .limit(1);

      if (existingPayment.length > 0) {
        console.log('[Creem] One-time payment already processed:', orderId);
        return;
      }

      await this.updateUserWithCustomerId(customerId, customer.email);

      const resolvedUserId =
        userIdFromMetadata || (await this.findUserIdByCustomerId(customerId));

      await this.createOneTimePaymentRecord(
        resolvedUserId,
        customerId,
        productId,
        data,
        'checkout.completed'
      );

      if (websiteConfig.credits?.enableCredits && resolvedUserId) {
        await addLifetimeMonthlyCredits(resolvedUserId, productId);
        console.log('[Creem] << Added lifetime monthly credits for user');
      } else if (websiteConfig.credits?.enableCredits && !resolvedUserId) {
        console.warn(
          '[Creem] Credits enabled, but cannot resolve userId for one-time payment:',
          { orderId, customerId }
        );
      }

      if (order) {
        await sendNotification(
          orderId,
          customerId,
          resolvedUserId || 'unknown',
          order.total_amount / 100
        );
      }

      console.log('[Creem] << One-time payment processed');
    } catch (error) {
      console.error(
        '[Creem] onOnetimePayment error for order:',
        orderId,
        error
      );
      throw error;
    }
  }

  private async onToolSubmitProPurchase(
    data: WebhookEventObject
  ): Promise<void> {
    const { order, customer, metadata } = data;
    const toolId = metadata?.toolId; // 从 metadata 获取（预创建时生成）
    const userId = metadata?.userId;
    const userEmail = metadata?.userEmail || customer.email;
    const customerId = customer.id;
    const orderId = order?.id;

    if (!toolId || !orderId) {
      console.warn('[Creem] tool_submit_pro: missing toolId or orderId');
      return;
    }

    try {
      const db = await getDb();

      // 幂等检查：检查 payment 是否已处理
      const existingPayment = await db
        .select({ id: payment.id })
        .from(payment)
        .where(eq(payment.sessionId, orderId))
        .limit(1);

      if (existingPayment.length > 0) {
        console.log('[Creem] tool_submit_pro already processed:', orderId);
        return;
      }

      // 获取工具当前状态
      const toolRecord = await db
        .select({ status: tools.status })
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1);

      if (toolRecord.length === 0) {
        console.warn('[Creem] tool_submit_pro: tool not found:', toolId);
        return;
      }

      if (toolRecord[0].status !== 'unpaid') {
        console.log(
          '[Creem] tool already processed:',
          toolId,
          'status:',
          toolRecord[0].status
        );
        return;
      }

      await this.updateUserWithCustomerId(customerId, customer.email);
      const resolvedUserId =
        userId || (await this.findUserIdByCustomerId(customerId));

      const now = new Date();
      const productId = data.product?.id || '';

      // 事务：更新工具状态 + 创建 payment 记录
      await db.transaction(async (tx) => {
        // 1. 更新工具状态为 pending，支付成功自动精选
        await tx
          .update(tools)
          .set({
            status: 'pending',
            featured: true,
            updatedAt: now,
          })
          .where(eq(tools.id, toolId));

        // 2. 创建 payment 记录
        await tx.insert(payment).values({
          id: randomUUID(),
          priceId: productId,
          type: PaymentTypes.ONE_TIME,
          userId: resolvedUserId,
          customerId,
          sessionId: orderId,
          status: 'completed',
          periodStart: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      const amount = order?.total_amount ? order.total_amount / 100 : 0;
      await sendNotification(
        orderId,
        customerId,
        resolvedUserId || 'unknown',
        amount
      );

      console.log(
        '[Creem] << tool_submit_pro: tool updated to pending, orderId:',
        orderId
      );
    } catch (error) {
      console.error('[Creem] onToolSubmitProPurchase error:', orderId, error);
      throw error;
    }
  }

  private async onCreditPurchase(data: WebhookEventObject): Promise<void> {
    console.log('[Creem] >> Handle credit purchase');
    const { order, customer, metadata } = data;

    const userIdFromMetadata = metadata?.userId;
    const customerId = customer.id;
    const packageId = metadata?.packageId;
    const orderId = order?.id;

    if (!packageId || !orderId) {
      console.warn(
        '[Creem] Missing userId/packageId/orderId for credit purchase'
      );
      return;
    }

    try {
      const db = await getDb();
      const existingPayment = await db
        .select({ id: payment.id })
        .from(payment)
        .where(eq(payment.sessionId, orderId))
        .limit(1);

      if (existingPayment.length > 0) {
        console.log('[Creem] Credit purchase already processed:', orderId);
        return;
      }

      await this.updateUserWithCustomerId(customerId, customer.email);

      const resolvedUserId =
        userIdFromMetadata || (await this.findUserIdByCustomerId(customerId));
      if (!resolvedUserId) {
        console.warn('[Creem] Cannot resolve userId for credit purchase:', {
          orderId,
          customerId,
          packageId,
        });
        return;
      }

      const creditPackage = getCreditPackageById(packageId);
      if (!creditPackage) {
        console.warn('[Creem] Credit package not found:', packageId);
        return;
      }

      const now = new Date();
      await db.insert(payment).values({
        id: randomUUID(),
        priceId: metadata?.priceId || '',
        type: PaymentTypes.ONE_TIME,
        userId: resolvedUserId,
        customerId: customerId,
        sessionId: orderId,
        status: 'completed',
        periodStart: now,
        createdAt: now,
        updatedAt: now,
      });

      const amount = order?.total_amount ? order.total_amount / 100 : 0;
      await addCredits({
        userId: resolvedUserId,
        amount: creditPackage.amount,
        type: CREDIT_TRANSACTION_TYPE.PURCHASE_PACKAGE,
        description: `+${creditPackage.amount} credits from Creem package ${packageId} ($${amount.toLocaleString()})`,
        paymentId: orderId,
        expireDays: creditPackage.expireDays,
      });

      console.log('[Creem] << Added credits to user:', creditPackage.amount);

      await sendNotification(orderId, customerId, resolvedUserId, amount);
    } catch (error) {
      console.error(
        '[Creem] onCreditPurchase error for order:',
        orderId,
        error
      );
      throw error;
    }
  }

  private async onUpdateSubscription(
    data: WebhookEventObject,
    eventType: string
  ): Promise<void> {
    console.log(
      '[Creem] >> Update subscription payment record, event:',
      eventType
    );
    const { id, product, customer, metadata } = data;

    if (!id || !product?.id) {
      console.warn('[Creem] Missing subscription/product ID in update event');
      return;
    }

    const userIdFromMetadata = metadata?.userId;
    const customerId = customer.id;
    const productId = product.id;

    // Metadata may be missing on subscription events; fallback to the user mapped by customerId.
    const resolvedUserId =
      userIdFromMetadata || (await this.findUserIdByCustomerId(customerId));

    const db = await getDb();
    const payments = await db
      .select({
        userId: payment.userId,
        periodStart: payment.periodStart,
        periodEnd: payment.periodEnd,
      })
      .from(payment)
      .where(eq(payment.subscriptionId, id))
      .limit(1);

    const newPeriodStart = data.current_period_start_date
      ? new Date(data.current_period_start_date)
      : undefined;

    const isRenewal =
      eventType === 'paid' &&
      payments.length > 0 &&
      payments[0].periodStart &&
      newPeriodStart &&
      payments[0].periodStart.getTime() !== newPeriodStart.getTime();

    console.log('[Creem] Renewal detection:', {
      eventType,
      isRenewal,
    });

    await this.createOrUpdateSubscriptionRecord(
      resolvedUserId,
      customerId,
      productId,
      data,
      `subscription.${eventType}`
    );

    if (isRenewal && resolvedUserId && websiteConfig.credits?.enableCredits) {
      await addSubscriptionCredits(resolvedUserId, productId);
      console.log('[Creem] << Added subscription renewal credits for user');
    } else if (
      isRenewal &&
      websiteConfig.credits?.enableCredits &&
      !resolvedUserId
    ) {
      console.warn(
        '[Creem] Renewal detected but cannot resolve userId; skip credits:',
        { subscriptionId: id, customerId }
      );
    }

    await sendNotification(id, customerId, resolvedUserId || 'unknown', 0);

    console.log('[Creem] << Updated subscription payment record');
  }

  private async onDeleteSubscription(data: WebhookEventObject): Promise<void> {
    console.log('[Creem] >> Delete subscription:', data.id);
    const { id } = data;

    if (!id) {
      console.warn('[Creem] No subscription ID found in delete event');
      return;
    }

    const db = await getDb();

    const records = await db
      .select()
      .from(payment)
      .where(eq(payment.subscriptionId, id))
      .limit(1);

    await db
      .update(payment)
      .set({
        status: 'canceled',
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      })
      .where(eq(payment.subscriptionId, id));

    if (records.length > 0) {
      const record = records[0];
      await sendNotification(
        id,
        record.customerId,
        record.userId || 'unknown',
        0
      );
    }

    console.log('[Creem] << Subscription deleted successfully');
  }

  private async onRefundCreated(data: WebhookEventObject): Promise<void> {
    console.log('[Creem] >> Handle refund created');
    const { refund_amount, transaction, subscription, order } = data;
    const refundId = transaction?.id || order?.id || 'refund';
    const refundAmountInDollars = refund_amount ? refund_amount / 100 : 0;

    try {
      const db = await getDb();
      type PaymentRecord = typeof payment.$inferSelect;
      let paymentRecord: PaymentRecord | null = null;
      let customerId = 'unknown';
      let userId = 'unknown';

      if (subscription?.id) {
        const records = await db
          .select()
          .from(payment)
          .where(eq(payment.subscriptionId, subscription.id))
          .limit(1);

        if (records.length > 0) {
          paymentRecord = records[0];
        }
      }

      if (!paymentRecord && (transaction?.id || order?.id)) {
        const sessionId = transaction?.id || order?.id;
        if (sessionId) {
          const records = await db
            .select()
            .from(payment)
            .where(eq(payment.sessionId, sessionId))
            .limit(1);

          if (records.length > 0) {
            paymentRecord = records[0];
          }
        }
      }

      if (paymentRecord) {
        customerId = paymentRecord.customerId;
        userId = paymentRecord.userId || 'unknown';

        await db
          .update(payment)
          .set({
            status: 'canceled',
            updatedAt: new Date(),
          })
          .where(eq(payment.id, paymentRecord.id));

        console.log(
          '[Creem] Payment record updated to canceled:',
          paymentRecord.id
        );
      } else {
        console.warn('[Creem] No payment record found for refund:', refundId);
      }

      await sendNotification(
        refundId,
        customerId,
        userId,
        refundAmountInDollars
      );

      console.log('[Creem] << Refund processed successfully');
    } catch (error) {
      console.error(
        '[Creem] onRefundCreated error for refund:',
        refundId,
        error
      );
      throw error;
    }
  }

  private async onDisputeCreated(data: WebhookEventObject): Promise<void> {
    const { dispute_amount, transaction } = data;

    await sendNotification(
      transaction?.id || 'dispute',
      'unknown',
      'unknown',
      (dispute_amount || 0) / 100
    );
  }

  private async createOrUpdateSubscriptionRecord(
    userId: string | undefined,
    customerId: string,
    productId: string,
    data: WebhookEventObject,
    eventType: string
  ): Promise<void> {
    const db = await getDb();

    const plan = findPlanByPriceId(productId);
    if (!plan) {
      console.warn(`Plan not found for product ID: ${productId}`);
      return;
    }

    const price = findPriceInPlan(plan.id, productId);
    if (!price) {
      console.warn(`Price not found in plan for product ID: ${productId}`);
      return;
    }

    let resolvedUserId = userId;
    if (!resolvedUserId) {
      resolvedUserId = await this.findUserIdByCustomerId(customerId);
    }

    if (!resolvedUserId) {
      console.error('Cannot create subscription record: userId not found');
      return;
    }

    const subscriptionId = data.subscription?.id || data.id;
    if (!subscriptionId) {
      console.error(
        'Cannot create subscription record: subscriptionId not found'
      );
      return;
    }

    const status = this.mapCreemStatusToPaymentStatus(data.status || 'active');
    const interval = this.mapCreemPeriodToInterval(
      data.billing_period || data.subscription?.billing_period || 'every-month'
    );

    const existingPayments = await db
      .select()
      .from(payment)
      .where(eq(payment.subscriptionId, subscriptionId))
      .limit(1);
    const existingPayment = existingPayments[0];

    const periodStartDate =
      data.current_period_start_date ||
      data.subscription?.current_period_start_date;
    const periodEndDate =
      data.current_period_end_date ||
      data.subscription?.current_period_end_date;
    const cancelAtPeriodEnd =
      data.cancel_at_period_end || data.subscription?.cancel_at_period_end;

    if (existingPayment) {
      if (status === 'trialing') {
        const updateData: {
          status: PaymentStatus;
          updatedAt: Date;
          trialStart?: Date;
          trialEnd?: Date;
        } = {
          status,
          updatedAt: new Date(),
        };

        if (periodStartDate) {
          updateData.trialStart = new Date(periodStartDate);
        }
        if (periodEndDate) {
          updateData.trialEnd = new Date(periodEndDate);
        }

        await db
          .update(payment)
          .set(updateData)
          .where(eq(payment.id, existingPayment.id));
      } else {
        await db
          .update(payment)
          .set({
            status,
            periodStart: periodStartDate
              ? new Date(periodStartDate)
              : undefined,
            periodEnd: periodEndDate ? new Date(periodEndDate) : undefined,
            cancelAtPeriodEnd: cancelAtPeriodEnd || false,
            updatedAt: new Date(),
          })
          .where(eq(payment.id, existingPayment.id));
      }
    } else {
      const insertData: SubscriptionInsertData = {
        id: randomUUID(),
        userId: resolvedUserId,
        customerId,
        type: PaymentTypes.SUBSCRIPTION,
        status,
        subscriptionId: subscriptionId,
        priceId: productId,
        interval,
        periodStart: periodStartDate ? new Date(periodStartDate) : undefined,
        periodEnd: periodEndDate ? new Date(periodEndDate) : undefined,
        cancelAtPeriodEnd: cancelAtPeriodEnd || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (status === 'trialing') {
        if (periodStartDate) {
          insertData.trialStart = new Date(periodStartDate);
        }
        if (periodEndDate) {
          insertData.trialEnd = new Date(periodEndDate);
        }
      }

      await db.insert(payment).values(insertData);
    }
  }

  private async createOneTimePaymentRecord(
    userId: string | undefined,
    customerId: string,
    productId: string,
    data: WebhookEventObject,
    eventType: string
  ): Promise<void> {
    const db = await getDb();

    const plan = findPlanByPriceId(productId);
    if (!plan) {
      console.warn(`Plan not found for product ID: ${productId}`);
      return;
    }

    const price = findPriceInPlan(plan.id, productId);
    if (!price) {
      console.warn(`Price not found in plan for product ID: ${productId}`);
      return;
    }

    let resolvedUserId = userId;
    if (!resolvedUserId) {
      resolvedUserId = await this.findUserIdByCustomerId(customerId);
    }

    if (!resolvedUserId) {
      console.error('Cannot create one-time payment record: userId not found');
      return;
    }

    await db.insert(payment).values({
      id: randomUUID(),
      userId: resolvedUserId,
      customerId,
      type: PaymentTypes.ONE_TIME,
      status: 'completed',
      sessionId: data.order?.id,
      priceId: productId,
      periodStart: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private async findUserIdByCustomerId(
    customerId: string
  ): Promise<string | undefined> {
    const db = await getDb();
    const userRecords = await db
      .select()
      .from(user)
      .where(eq(user.customerId, customerId))
      .limit(1);
    return userRecords[0]?.id;
  }

  private async updateUserWithCustomerId(
    customerId: string,
    email: string
  ): Promise<void> {
    const db = await getDb();
    await db
      .update(user)
      .set({
        customerId,
        updatedAt: new Date(),
      })
      .where(eq(user.email, email));
  }

  private mapCreemStatusToPaymentStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      active: 'active',
      canceled: 'canceled',
      past_due: 'past_due',
      incomplete: 'incomplete',
      trialing: 'trialing',
      paused: 'paused',
      completed: 'completed',
    };

    return statusMap[status] || 'active';
  }

  private mapCreemPeriodToInterval(period: string): PlanInterval {
    if (period === 'every-month') return PlanIntervals.MONTH;
    if (period === 'every-year') return PlanIntervals.YEAR;
    return PlanIntervals.MONTH;
  }
}
