/**
 * @file page.tsx
 * @description AI Tools Directory - Discover the Best AI Tools (database-backed)
 * @author yiangto
 * @date 2026-02-03
 */

import { getTools } from '@/actions/tools/get-tools';
import { HeroSearchSection } from '@/components/landing/hero-search-section';
import { LatestToolsSection } from '@/components/landing/latest-tools-section';
import { SubmitToolCta } from '@/components/landing/submit-tool-cta';
import { MultipleSchemaRenderer } from '@/components/schema/schema-renderer';
import { constructMetadata } from '@/lib/metadata';
import {
  generateOrganizationSchema,
  generateWebsiteSchema,
} from '@/lib/schema';
import type { SerializableTool } from '@/lib/source';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('HomePage');
  return constructMetadata({
    title: t('title'),
    description: t('description'),
    canonicalUrl: getUrlWithLocale('/', locale),
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('HomePage');

  // 并行获取最新工具和精选工具
  const [{ items }, { items: featuredItems }] = await Promise.all([
    getTools({
      locale,
      page: 1,
      pageSize: 100, // 获取足够多的工具用于首页展示
      published: true,
    }),
    getTools({
      locale,
      page: 1,
      pageSize: 48, // 精选最多 4×12
      featured: true,
      published: true,
    }),
  ]);

  // 转换为 SerializableTool 格式
  const toSerializable = (item: (typeof items)[0]) => ({
    data: {
      id: item.id,
      slug: item.slug,
      name: item.name,
      title: item.title,
      description: item.description || '',
      href: `/tools/${item.slug}`,
      url: item.url,
      image: item.imageUrl || '',
      thumbnailUrl: item.thumbnailUrl || '',
      collectionTime:
        item.collectionTime?.toISOString() || new Date().toISOString(),
      starRating: item.starRating || 5,
      category: item.tags,
      tags: item.tags,
      featured: item.featured || false,
      published: item.published || true,
    },
  });

  const serializableTools: SerializableTool[] = items.map((item) =>
    toSerializable(item)
  );
  const featuredTools: SerializableTool[] = featuredItems.map((item) =>
    toSerializable(item)
  );

  // 准备翻译对象
  const heroTranslations = {
    badge: t('hero.badge'),
    title: t('hero.title'),
    subtitle: t('hero.subtitle'),
    searchPlaceholder: t('hero.searchPlaceholder'),
  };

  const latestToolsTranslations = {
    justLaunched: t('latestTools.justLaunched'),
    viewAll: t('latestTools.viewAll'),
    featuredTitle: t('latestTools.featuredTitle'),
  };

  const submitCtaTranslations = {
    badge: t('submitCta.badge'),
    title: t('submitCta.title'),
    description: t('submitCta.description'),
    button: t('submitCta.button'),
  };

  return (
    <>
      <MultipleSchemaRenderer
        schemas={[generateOrganizationSchema(), generateWebsiteSchema(locale)]}
      />
      <main className="min-h-screen bg-background text-foreground">
        {/* Hero Section - Search First */}
        <HeroSearchSection locale={locale} translations={heroTranslations} />

        {/* Latest Tools Section */}
        <LatestToolsSection
          tools={serializableTools}
          featuredTools={featuredTools}
          locale={locale}
          translations={latestToolsTranslations}
        />

        {/* Submit Tool CTA */}
        <SubmitToolCta locale={locale} translations={submitCtaTranslations} />
      </main>
    </>
  );
}
