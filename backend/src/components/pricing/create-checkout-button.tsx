'use client';

import { createCheckoutAction } from '@/actions/create-checkout-session';
import { Button } from '@/components/ui/button';
import { websiteConfig } from '@/config/website';
import { Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface CheckoutButtonProps {
  userId: string;
  planId: string;
  priceId: string;
  metadata?: Record<string, string>;
  variant?:
    | 'default'
    | 'outline'
    | 'destructive'
    | 'secondary'
    | 'ghost'
    | 'link'
    | null;
  size?: 'default' | 'sm' | 'lg' | 'icon' | null;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Checkout Button
 *
 * This client component creates a Stripe checkout session and redirects to it
 * It's used to initiate the checkout process for a specific plan and price.
 *
 * NOTICE: Login is required when using this button.
 */
export function CheckoutButton({
  userId,
  planId,
  priceId,
  metadata,
  variant = 'default',
  size = 'default',
  className,
  children,
}: CheckoutButtonProps) {
  const t = useTranslations('PricingPage.CheckoutButton');
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    try {
      setIsLoading(true);

      const mergedMetadata = metadata ? { ...metadata } : {};

      // add promotekit_referral to metadata if enabled promotekit affiliate
      if (websiteConfig.features.enablePromotekitAffiliate) {
        const promotekitReferral =
          typeof window !== 'undefined'
            ? (window as any).promotekit_referral
            : undefined;
        if (promotekitReferral) {
          console.log(
            'create checkout button, promotekitReferral:',
            promotekitReferral
          );
          mergedMetadata.promotekit_referral = promotekitReferral;
        }
      }

      // add affonso_referral to metadata if enabled affonso affiliate
      if (websiteConfig.features.enableAffonsoAffiliate) {
        const affonsoReferral =
          typeof document !== 'undefined'
            ? (() => {
                const match = document.cookie.match(
                  /(?:^|; )affonso_referral=([^;]*)/
                );
                return match ? decodeURIComponent(match[1]) : null;
              })()
            : null;
        if (affonsoReferral) {
          console.log(
            'create checkout button, affonsoReferral:',
            affonsoReferral
          );
          mergedMetadata.affonso_referral = affonsoReferral;
        }
      }

      // Create checkout session using server action
      const actionParams = {
        userId,
        planId,
        priceId,
        metadata:
          Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
      };
      console.log('[CheckoutButton] Action params:', actionParams);

      const result = await createCheckoutAction(actionParams);
      console.log(
        '[CheckoutButton] Action result:',
        JSON.stringify(result, null, 2)
      );

      // Redirect to checkout page
      if (result?.data?.success && result.data.data?.url) {
        window.location.href = result.data.data?.url;
      } else {
        console.error('Create checkout session error, result:', result);
        // 添加更详细的错误信息
        if (result?.validationErrors) {
          console.error('Validation errors:', result.validationErrors);
        }
        if (result?.serverError) {
          console.error('Server error:', result.serverError);
        }
        toast.error(t('checkoutFailed'));
      }
    } catch (error) {
      console.error('Create checkout session error:', error);
      // 区分网络级错误（如 Server Action fetch 失败、未启动 dev 服务）
      const msg = error instanceof Error ? error.message : String(error ?? '');
      const isNetworkError =
        error instanceof TypeError &&
        (msg === 'Failed to fetch' || msg.includes('fetch'));
      toast.error(
        isNetworkError ? t('checkoutNetworkError') : t('checkoutFailed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2Icon className="mr-2 size-4 animate-spin" />
          {t('loading')}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
