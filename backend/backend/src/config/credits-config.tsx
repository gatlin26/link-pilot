'use client';

import type { CreditPackage } from '@/credits/types';
import { useTranslations } from 'next-intl';
import { websiteConfig } from './website';

/**
 * Get credit packages with translations for client components
 *
 * NOTICE: This function should only be used in client components.
 * If you need to get the credit packages in server components, use getAllCreditPackages instead.
 * Use this function when showing the credit packages to the user.
 *
 * docs:
 * https://mksaas.com/docs/config/credits
 *
 * @returns The credit packages with translated content
 */
export function useCreditPackages(): Record<string, CreditPackage> {
  const t = useTranslations('CreditPackages');
  const creditConfig = websiteConfig.credits;
  const packages: Record<string, CreditPackage> = {};

  // Starter: 200 Credits / $4.99
  if (creditConfig.packages.starter) {
    packages.starter = {
      ...creditConfig.packages.starter,
      name: t('starter.name'),
      description: t('starter.description'),
    };
  }

  // Popular: 1000 Credits / $16.99
  if (creditConfig.packages.popular) {
    packages.popular = {
      ...creditConfig.packages.popular,
      name: t('popular.name'),
      description: t('popular.description'),
    };
  }

  // Pro: 3000 Credits / $39.99
  if (creditConfig.packages.pro) {
    packages.pro = {
      ...creditConfig.packages.pro,
      name: t('pro.name'),
      description: t('pro.description'),
    };
  }

  return packages;
}
