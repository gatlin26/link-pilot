'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { websiteConfig } from '@/config/website';
import { useLocalePathname, useLocaleRouter } from '@/i18n/navigation';
import { useLocaleStore } from '@/stores/locale-store';
import { Languages } from 'lucide-react';
import { type Locale, useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useTransition } from 'react';

/**
 * LocaleSwitcher component
 *
 * Allows users to switch between available locales using a dropdown menu.
 *
 * Based on next-intl's useLocaleRouter and useLocalePathname for locale navigation.
 * https://next-intl.dev/docs/routing/navigation#userouter
 */
export default function LocaleSwitcher() {
  // Return null if there's only one locale available
  const showLocaleSwitch = Object.keys(websiteConfig.i18n.locales).length > 1;
  if (!showLocaleSwitch) {
    return null;
  }

  const router = useLocaleRouter();
  const pathname = useLocalePathname();
  const params = useParams();
  const locale = useLocale();
  const { currentLocale, setCurrentLocale } = useLocaleStore();
  const [, startTransition] = useTransition();
  const t = useTranslations('Common');

  useEffect(() => {
    setCurrentLocale(locale);
  }, [locale, setCurrentLocale]);

  const setLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    setCurrentLocale(nextLocale);

    startTransition(() => {
      // 使用新 locale 更新 params，确保 next-intl 正确构建目标 URL
      const nextParams = { ...params, locale: nextLocale } as typeof params;
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { pathname, params: nextParams },
        { locale: nextLocale }
      );
      // 强制刷新以重新获取按 locale 加载的服务端数据（如 changelog）
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0.5 border border-border rounded-full cursor-pointer"
        >
          <Languages className="size-3" />
          <span className="sr-only">{t('language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-0">
        {Object.entries(websiteConfig.i18n.locales).map(
          ([localeOption, data]) => (
            <DropdownMenuItem
              key={localeOption}
              onClick={() => setLocale(localeOption)}
              className="cursor-pointer px-2 py-1.5"
            >
              <span className="text-sm">{data.name}</span>
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
