'use client';

import type { PricePlan } from '@/payment/types';
import { useTranslations } from 'next-intl';
import { websiteConfig } from './website';

/**
 * Get price plans with translations for client components
 *
 * NOTICE: This function should only be used in client components.
 * If you need to get the price plans in server components, use getAllPricePlans instead.
 * Use this function when showing the pricing table or the billing card to the user.
 *
 * docs:
 * https://mksaas.com/docs/config/price
 *
 * @author peiwen
 * @date 2025-12-20
 *
 * @returns The price plans with translated content
 */
export function usePricePlans(): Record<string, PricePlan> {
  const t = useTranslations('PricePlans');
  const priceConfig = websiteConfig.price;
  const plans: Record<string, PricePlan> = {};

  // Free plan
  if (priceConfig.plans.free) {
    plans.free = {
      ...priceConfig.plans.free,
      name: t('free.name'),
      description: t('free.description'),
      features: [
        t('free.features.feature-1'),
        t('free.features.feature-2'),
        t('free.features.feature-3'),
        t('free.features.feature-4'),
        t('free.features.feature-5'),
        t('free.features.feature-6'),
      ],
      limits: [],
    };
  }

  // Basic plan
  if (priceConfig.plans.basic) {
    plans.basic = {
      ...priceConfig.plans.basic,
      name: t('basic.name'),
      description: t('basic.description'),
      features: [
        t('basic.features.feature-1'),
        t('basic.features.feature-2'),
        t('basic.features.feature-3'),
        t('basic.features.feature-4'),
        t('basic.features.feature-5'),
        t('basic.features.feature-6'),
      ],
      limits: [],
    };
  }

  // Pro plan
  if (priceConfig.plans.pro) {
    plans.pro = {
      ...priceConfig.plans.pro,
      name: t('pro.name'),
      description: t('pro.description'),
      features: [
        t('pro.features.feature-1'),
        t('pro.features.feature-2'),
        t('pro.features.feature-3'),
        t('pro.features.feature-4'),
        t('pro.features.feature-5'),
        t('pro.features.feature-6'),
        t('pro.features.feature-7'),
        t('pro.features.feature-8'),
      ],
      limits: [],
    };
  }

  return plans;
}
