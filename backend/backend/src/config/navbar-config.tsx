'use client';

import { Routes } from '@/routes';
import type { NestedMenuItem } from '@/types';
import { useTranslations } from 'next-intl';

/**
 * Get navbar config with translations
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://mksaas.com/docs/config/navbar
 *
 * @returns The navbar config with translated titles and descriptions
 */
export function useNavbarLinks(): NestedMenuItem[] {
  const t = useTranslations('Marketing.navbar');

  return [
    {
      title: t('tools.title'),
      href: Routes.Tools,
      external: false,
    },
    {
      title: t('submit.title'),
      href: Routes.ToolsSubmit,
      external: false,
    },
    {
      title: t('blog.title'),
      href: Routes.Blog,
      external: false,
    },
  ];
}
