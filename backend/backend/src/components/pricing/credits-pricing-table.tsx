'use client';

/**
 * @file credits-pricing-table.tsx
 * @description Credits 定价表组件 - 用于公开的 pricing 页面
 * @author git.username
 * @date 2025-12-27
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCreditPackages } from '@/config/credits-config';
import { websiteConfig } from '@/config/website';
import { useCurrentUser } from '@/hooks/use-current-user';
import { LocaleLink } from '@/i18n/navigation';
import { formatPrice } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { CheckIcon, CoinsIcon, SparklesIcon, ZapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CreditCheckoutButton } from '../settings/credits/credit-checkout-button';

interface CreditsPricingTableProps {
  className?: string;
}

/**
 * Credits 定价表组件
 * 展示所有可购买的 Credits 套餐
 */
export function CreditsPricingTable({ className }: CreditsPricingTableProps) {
  const t = useTranslations('PricingPage');
  const tPackages = useTranslations('CreditPackages');
  const currentUser = useCurrentUser();

  // 检查是否启用 credits
  if (!websiteConfig.credits.enableCredits) {
    return null;
  }

  // 获取 credits 套餐
  // 注意：不再过滤 priceId，允许在未配置 Stripe 时也显示套餐
  const creditPackages = Object.values(useCreditPackages()).filter(
    (pkg) => !pkg.disabled
  );

  // 套餐特点配置
  const packageFeatures: Record<string, string[]> = {
    starter: [
      'credits.features.allModels',
      'credits.features.noExpiry',
      'credits.features.standardSupport',
    ],
    popular: [
      'credits.features.allModels',
      'credits.features.noExpiry',
      'credits.features.prioritySupport',
      'credits.features.bestValue',
    ],
    pro: [
      'credits.features.allModels',
      'credits.features.noExpiry',
      'credits.features.prioritySupport',
      'credits.features.bulkDiscount',
    ],
  };

  // 计算原价和折扣
  const basePricePerCredit = 0.025; // Starter 的单价作为基准

  const getOriginalPrice = (pkg: (typeof creditPackages)[0]): number => {
    return Math.round(pkg.amount * basePricePerCredit * 100); // 转换为分
  };

  const getDiscount = (packageId: string): number | null => {
    const pkg = creditPackages.find((p) => p.id === packageId);
    if (!pkg) return null;
    const originalPrice = getOriginalPrice(pkg);
    const discount = Math.round((1 - pkg.price.amount / originalPrice) * 100);
    return discount > 0 ? discount : null;
  };

  // 获取套餐图标
  const getPackageIcon = (packageId: string) => {
    switch (packageId) {
      case 'starter':
        return <CoinsIcon className="h-6 w-6" />;
      case 'popular':
        return <SparklesIcon className="h-6 w-6" />;
      case 'pro':
        return <ZapIcon className="h-6 w-6" />;
      default:
        return <CoinsIcon className="h-6 w-6" />;
    }
  };

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {/* 套餐卡片 */}
      <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto w-full">
        {creditPackages.map((pkg) => {
          const discount = getDiscount(pkg.id);
          const features = packageFeatures[pkg.id] || [];

          return (
            <Card
              key={pkg.id}
              className={cn(
                'relative flex flex-col',
                pkg.popular
                  ? 'border-primary shadow-lg scale-105 z-10'
                  : 'border-border'
              )}
            >
              {/* Popular 标签 */}
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    {t('PricingCard.popular')}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                {/* 图标 */}
                <div
                  className={cn(
                    'mx-auto mb-2 p-3 rounded-full',
                    pkg.popular
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {getPackageIcon(pkg.id)}
                </div>

                {/* 套餐名称 */}
                <CardTitle className="text-xl">{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                {/* 价格区域 */}
                <div className="text-center mb-6">
                  <div className="flex flex-col items-center gap-1">
                    {/* 原价和当前价格 */}
                    {discount && discount > 0 ? (
                      <div className="flex items-baseline justify-center gap-2">
                        {/* 当前价格 */}
                        <span className="text-4xl font-bold">
                          {formatPrice(pkg.price.amount, pkg.price.currency)}
                        </span>
                        {/* 原价（划线） */}
                        <span className="text-lg text-muted-foreground line-through">
                          {formatPrice(
                            getOriginalPrice(pkg),
                            pkg.price.currency
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold">
                          {formatPrice(pkg.price.amount, pkg.price.currency)}
                        </span>
                      </div>
                    )}

                    {/* 折扣标签 */}
                    {discount && discount > 0 && (
                      <Badge variant="secondary" className="mt-1">
                        {discount}% OFF
                      </Badge>
                    )}
                  </div>

                  {/* Credits 数量 */}
                  <div className="flex items-center justify-center gap-2 mt-3 text-muted-foreground">
                    <CoinsIcon className="h-4 w-4" />
                    <span className="font-medium">
                      {pkg.amount.toLocaleString()} Credits
                    </span>
                  </div>

                  {/* 单价 */}
                  <p className="text-sm text-muted-foreground mt-2">
                    ${(pkg.price.amount / 100 / pkg.amount).toFixed(3)} / credit
                  </p>
                </div>

                {/* 特点列表 */}
                <ul className="space-y-3 mb-6 flex-1">
                  {features.map((featureKey) => (
                    <li key={featureKey} className="flex items-center gap-2">
                      <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="text-sm">
                        {t(featureKey as Parameters<typeof t>[0])}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* 购买按钮 */}
                {currentUser ? (
                  <CreditCheckoutButton
                    userId={currentUser.id}
                    packageId={pkg.id}
                    priceId={pkg.price.priceId}
                    className="w-full"
                    variant={pkg.popular ? 'default' : 'outline'}
                  >
                    {t('PricingCard.getStarted')}
                  </CreditCheckoutButton>
                ) : (
                  <Button
                    asChild
                    className="w-full"
                    variant={pkg.popular ? 'default' : 'outline'}
                  >
                    <LocaleLink href="/sign-up">
                      {t('PricingCard.getStartedForFree')}
                    </LocaleLink>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 有效期说明 */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {t('credits.validityNotice')}
        </p>
      </div>

      {/* 注册赠送提示 */}
      {websiteConfig.credits.registerGiftCredits.enable && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t('credits.registerGift', {
              amount: websiteConfig.credits.registerGiftCredits.amount,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
