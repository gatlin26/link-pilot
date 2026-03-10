/**
 * @file tools/page.tsx
 * @description Tools list page with search support (database-backed with ISR)
 * @author yiangto
 * @date 2026-02-02
 */

import { getTools } from '@/actions/tools/get-tools';
import { SearchBar } from '@/components/tools/search-bar';
import { ToolsGridWithPagination } from '@/components/tools/tools-grid-with-pagination';
import { constructMetadata } from '@/lib/metadata';
import type { SerializableTool } from '@/lib/source';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

// ISR: 每6小时重新验证（优化成本）
// 配合按需重新验证（revalidatePath），更新时立即生效
export const revalidate = 21600;

const TOOLS_PER_PAGE = 20;

interface ToolsPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export async function generateMetadata({
  params,
}: ToolsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ToolsPage' });

  return constructMetadata({
    title: t('title'),
    description: t('description'),
    canonicalUrl: getUrlWithLocale('/tools', locale),
    locale: locale as Locale,
  });
}

export default async function ToolsPage({
  params,
  searchParams,
}: ToolsPageProps) {
  const { locale } = await params;
  const { search, page } = await searchParams;
  const searchQuery = search || '';
  const currentPage = page ? Number.parseInt(page, 10) : 1;
  const t = await getTranslations('ToolsPage');

  // 从数据库获取工具列表
  const { items, total } = await getTools({
    locale,
    page: currentPage,
    pageSize: TOOLS_PER_PAGE,
    search: searchQuery,
    published: true,
  });

  const totalPages = Math.ceil(total / TOOLS_PER_PAGE);

  // 转换为 SerializableTool 格式
  const serializableTools: SerializableTool[] = items.map((item) => ({
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
      tagDetails: item.tagDetails, // 添加标签详情
      featured: item.featured || false,
      published: item.published || true,
    },
  }));

  return (
    <div className="relative min-h-screen overflow-hidden py-24 lg:py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />

      {/* Decorative blobs */}
      <div className="absolute left-0 top-1/4 size-[500px] rounded-full bg-gradient-to-br from-[#0052ff]/5 to-transparent blur-3xl" />
      <div className="absolute bottom-1/4 right-0 size-[400px] rounded-full bg-gradient-to-tl from-[#3d8bff]/5 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-12 text-center lg:mb-16">
          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0052ff]/20 bg-[#0052ff]/10 px-4 py-2 dark:border-[#3d8bff]/25 dark:bg-[#3d8bff]/15">
            <Sparkles className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
            <span className="text-sm font-semibold uppercase tracking-wider text-[#0052ff] dark:text-[#3d8bff]">
              {t('badge')}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-heading mb-5 text-3xl font-bold tracking-tight lg:text-5xl">
            <span className="bg-gradient-to-r from-[#0f172a] to-[#475569] bg-clip-text text-transparent dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('title')}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-[#64748b] dark:text-[#94a3b8] lg:text-xl">
            {t('description')}
          </p>
        </div>

        {/* Search Bar */}
        <SearchBar locale={locale} initialQuery={searchQuery} />

        {/* Search Results Info */}
        {searchQuery && (
          <div className="mb-8">
            <p className="text-[#64748b] dark:text-[#94a3b8]">
              {t('searchResults.found')}{' '}
              <span className="font-bold text-[#0052ff]">{total}</span>{' '}
              {total === 1 ? t('searchResults.tool') : t('searchResults.tools')}
              {searchQuery && (
                <>
                  {' '}
                  <span className="text-[#64748b] dark:text-[#94a3b8]">
                    {t('searchResults.about')}
                  </span>{' '}
                  <span className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                    "{searchQuery}"
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        {/* Total Tools Count */}
        {!searchQuery && (
          <div className="mb-8 text-center">
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
              {t('totalToolsCount', { count: total })}
            </p>
          </div>
        )}

        {/* Tools Grid */}
        <ToolsGridWithPagination
          tools={serializableTools}
          currentPage={currentPage}
          totalPages={totalPages}
          locale={locale}
        />
      </div>
    </div>
  );
}
