/**
 * Creem SDK TypeScript 类型定义
 *
 * @author peiwen
 * @date 2025-12-20
 */
declare module 'creem' {
  // ========== SDK 配置 ==========
  export interface CreemConfig {
    serverIdx?: 0 | 1; // 0=生产环境, 1=测试环境
  }

  // ========== Webhook 事件类型 ==========
  export type WebhookEventType =
    | 'checkout.completed'
    | 'subscription.active'
    | 'subscription.paid'
    | 'subscription.canceled'
    | 'subscription.expired'
    | 'subscription.update'
    | 'subscription.trialing'
    | 'subscription.paused'
    | 'refund.created'
    | 'dispute.created';

  /**
   * Webhook 事件对象结构
   * 用于替换所有 webhook 处理函数中的 any 类型
   */
  export interface WebhookEventObject {
    id?: string;
    status?: string;
    order?: {
      id: string;
      total_amount: number;
      status: string;
    };
    product?: {
      id: string;
      billing_type: 'recurring' | 'one-time';
    };
    subscription?: {
      id: string;
      status: string;
      current_period_start_date?: string;
      current_period_end_date?: string;
      billing_period?: string;
      cancel_at_period_end?: boolean;
    };
    customer: {
      id: string;
      email: string;
    };
    metadata?: Record<string, string>;
    // 用于订阅事件
    current_period_start_date?: string;
    current_period_end_date?: string;
    billing_period?: string;
    cancel_at_period_end?: boolean;
    // 用于退款事件
    refund_amount?: number;
    transaction?: {
      id: string;
    };
    // 用于争议事件
    dispute_amount?: number;
  }

  // ========== 请求类型 ==========
  export interface CreateCheckoutRequest {
    productId: string;
    requestId: string;
    successUrl: string;
    metadata?: Record<string, string>;
  }

  export interface CreateCustomerPortalLinkRequest {
    customerId: string;
  }

  export interface SubscriptionUpdateItem {
    priceId: string;
  }

  export type UpdateBehavior =
    | 'proration-none'
    | 'proration-charge'
    | 'proration-charge-immediately';

  export interface UpdateSubscriptionRequest {
    items: SubscriptionUpdateItem[];
    updateBehavior?: UpdateBehavior;
  }

  // ========== 响应类型 ==========
  export interface CheckoutResponse {
    checkoutUrl: string;
    id: string;
  }

  export interface CustomerPortalResponse {
    customerPortalLink: string;
  }

  export interface SubscriptionResponse {
    id: string;
    status: string;
    currentPeriodStartDate?: string;
    currentPeriodEndDate?: string;
    billingPeriod?: string;
    cancelAtPeriodEnd?: boolean;
  }

  // ========== SDK 主类 ==========
  export class Creem {
    constructor(config: CreemConfig);

    createCheckout(params: {
      xApiKey: string;
      createCheckoutRequest: CreateCheckoutRequest;
    }): Promise<CheckoutResponse>;

    generateCustomerLinks(params: {
      xApiKey: string;
      createCustomerPortalLinkRequestEntity: CreateCustomerPortalLinkRequest;
    }): Promise<CustomerPortalResponse>;

    updateSubscription(params: {
      id: string;
      xApiKey: string;
      updateSubscriptionRequestEntity: UpdateSubscriptionRequest;
    }): Promise<SubscriptionResponse>;

    cancelSubscription(params: {
      id: string;
      xApiKey: string;
    }): Promise<SubscriptionResponse>;
  }
}
