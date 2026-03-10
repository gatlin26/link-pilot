import { websiteConfig } from '@/config/website';
import { defaultMessages } from '@/i18n/messages';
import { routing } from '@/i18n/routing';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getBaseUrl, getImageUrl, shouldAppendLocale } from './urls/urls';

const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  zh: 'zh_CN',
  'zh-TW': 'zh_TW',
  ko: 'ko_KR',
  ja: 'ja_JP',
  pt: 'pt_BR',
  es: 'es_ES',
  de: 'de_DE',
  fr: 'fr_FR',
  vi: 'vi_VN',
};

/**
 * 生成 hreflang 语言映射（覆盖所有配置的 locale）
 */
function generateLanguageAlternates(
  canonicalUrl: string,
  _locale?: Locale
): Record<string, string> {
  const baseUrl = getBaseUrl();

  let path = canonicalUrl.replace(baseUrl, '');

  const localePattern = new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`);
  path = path.replace(localePattern, '');

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const alternates: Record<string, string> = {};
  for (const loc of routing.locales) {
    alternates[loc] = shouldAppendLocale(loc)
      ? `${baseUrl}/${loc}${path}`
      : `${baseUrl}${path}`;
  }
  alternates['x-default'] = `${baseUrl}${path}`;
  return alternates;
}

/**
 * Construct the metadata object for the current page (in docs/guides)
 */
export function constructMetadata({
  title,
  description,
  canonicalUrl,
  image,
  noIndex = false,
  locale,
}: {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  image?: string;
  noIndex?: boolean;
  locale?: Locale;
} = {}): Metadata {
  title = title || defaultMessages.Metadata.title;
  description = description || defaultMessages.Metadata.description;
  image = image || websiteConfig.metadata.images?.ogImage;
  const ogImageUrl = getImageUrl(image || '');
  return {
    title,
    description,
    alternates: canonicalUrl
      ? {
          canonical: canonicalUrl,
          languages: generateLanguageAlternates(canonicalUrl, locale),
        }
      : undefined,
    openGraph: {
      type: 'website',
      locale: OG_LOCALE_MAP[locale ?? 'en'] ?? 'en_US',
      url: canonicalUrl,
      title,
      description,
      siteName: defaultMessages.Metadata.name,
      images: [ogImageUrl.toString()],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl.toString()],
      site: getBaseUrl(),
    },
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon-32x32.png',
      apple: '/apple-touch-icon.png',
    },
    metadataBase: new URL(getBaseUrl()),
    // Use a same-origin relative URL to avoid CORS issues when users access the site
    // via different hostnames (e.g. `www` vs apex) and the platform enforces redirects.
    // Absolute manifest URLs easily end up cross-origin and get blocked.
    manifest: '/manifest.webmanifest',
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
