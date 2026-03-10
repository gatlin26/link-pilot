'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { websiteConfig } from '@/config/website';
import { getBaseUrl } from '@/lib/urls/urls';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

const BACKLINK_PATH = '';

function getLogoPath(theme: 'dark' | 'light'): string {
  const imgs = websiteConfig.metadata?.images;
  return theme === 'dark'
    ? imgs?.logoLight || '/logo.png'
    : imgs?.logoDark || '/logo-dark.png';
}

function getBadgeHtml(
  baseUrl: string,
  siteName: string,
  theme: 'dark' | 'light'
) {
  const href = `${baseUrl}${BACKLINK_PATH}`;
  const logoPath = getLogoPath(theme);
  const imgSrc = logoPath.startsWith('http')
    ? logoPath
    : `${baseUrl}${logoPath}`;
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">
  <img src="${imgSrc}" alt="Listed on ${siteName}" />
</a>`;
}

function getTextLinkHtml(baseUrl: string, siteName: string) {
  const href = `${baseUrl}${BACKLINK_PATH}`;
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${siteName}</a>`;
}

/**
 * 免费收录反链示例区块，直接展示在 FREE 卡片下方：徽章/文本链接、代码复制、预览
 */
export function BacklinkExampleBlock() {
  const t = useTranslations('ToolsPage.submit.backlinkNotice');
  const [badgeTheme, setBadgeTheme] = useState<'dark' | 'light'>('dark');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 避免 SSR / CSR baseUrl 不一致导致 hydration 报错，等客户端挂载后再计算
  useEffect(() => {
    setMounted(true);
  }, []);

  const baseUrl = mounted ? getBaseUrl() : '';
  const siteName = websiteConfig.metadata?.name || 'BuildWay';
  const logoPath = getLogoPath(badgeTheme);
  const logoSrc = baseUrl ? `${baseUrl}${logoPath}` : logoPath;

  const badgeCode = baseUrl ? getBadgeHtml(baseUrl, siteName, badgeTheme) : '';
  const textLinkCode = baseUrl ? getTextLinkHtml(baseUrl, siteName) : '';

  const handleCopy = useCallback((text: string) => {
    if (typeof navigator?.clipboard === 'undefined') return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="mt-4 min-w-0 overflow-hidden rounded-lg border border-violet-200/50 bg-violet-50/20 p-4 dark:border-violet-800/30 dark:bg-violet-950/10">
      <p className="mb-3 text-sm text-muted-foreground">{t('message')}</p>
      <Tabs defaultValue="badge" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="badge">{t('badgeTab')}</TabsTrigger>
          <TabsTrigger value="textLink">{t('textLinkTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="badge" className="space-y-3 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t('themeLabel')}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={badgeTheme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBadgeTheme('dark')}
              >
                {t('dark')}
              </Button>
              <Button
                type="button"
                variant={badgeTheme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBadgeTheme('light')}
              >
                {t('light')}
              </Button>
            </div>
          </div>
          <div className="relative min-w-0">
            <pre className="max-h-28 max-w-full overflow-auto rounded-md border bg-muted/50 p-2.5 text-xs">
              <code>{badgeCode}</code>
            </pre>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-6 w-6"
              onClick={() => handleCopy(badgeCode)}
              title={t('copyCode')}
            >
              {copied ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">
              {t('preview')}
            </span>
            <a
              href={baseUrl ? `${baseUrl}${BACKLINK_PATH}` : BACKLINK_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className={
                badgeTheme === 'dark'
                  ? 'inline-flex items-center gap-2 rounded-md bg-zinc-800 px-2.5 py-1.5 text-white'
                  : 'inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-100 px-2.5 py-1.5 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
              }
            >
              <img
                src={logoSrc}
                alt={siteName}
                className="h-5 w-auto max-w-[72px] object-contain"
              />
              <span className="text-xs font-medium">
                LISTED ON {siteName.toUpperCase().replace(/\s/g, '')}
              </span>
            </a>
          </div>
        </TabsContent>

        <TabsContent value="textLink" className="space-y-3 pt-3">
          <div className="relative min-w-0">
            <pre className="max-h-20 max-w-full overflow-auto rounded-md border bg-muted/50 p-2.5 text-xs">
              <code>{textLinkCode}</code>
            </pre>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-6 w-6"
              onClick={() => handleCopy(textLinkCode)}
              title={t('copyCode')}
            >
              {copied ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
