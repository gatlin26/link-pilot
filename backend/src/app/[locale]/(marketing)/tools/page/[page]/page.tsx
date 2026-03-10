/**
 * @file tools/page/[page]/page.tsx
 * @description Tools list page with pagination (database-backed with ISR)
 * @author yiangto
 * @date 2026-02-03
 */

import { getTools } from '@/actions/tools/get-tools';
import { ToolsGridWithPagination } from '@/components/tools/tools-grid-with-pagination';
import { LOCALES } from '@/i18n/routing';
import type { SerializableTool } from '@/lib/source';
import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

const TOOLS_PER_PAGE = 20;

// ISR: 每6小时重新验证（优化成本）
export const revalidate = 21600;

interface ToolsPageProps {
  params: Promise<{
    locale: string;
    page: string;
  }>;
}

export async function generateStaticParams() {
  const params: { locale: string; page: string }[] = [];

  for (const locale of LOCALES) {
    // 从数据库获取工具总数
    const { total } = await getTools({
      locale,
      page: 1,
      pageSize: 1,
      published: true,
    });

    const totalPages = Math.ceil(total / TOOLS_PER_PAGE);

    for (let i = 1; i <= totalPages; i++) {
      params.push({
        locale,
        page: i.toString(),
      });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: ToolsPageProps): Promise<Metadata> {
  const { locale, page } = await params;
  const t = await getTranslations({ locale, namespace: 'ToolsPage' });
  const pageNum = Number.parseInt(page, 10);

  return {
    title: `${t('title')} - Page ${pageNum}`,
    description: t('description'),
  };
}

export default async function ToolsPageWithPagination({
  params,
}: ToolsPageProps) {
  const { locale, page } = await params;
  const t = await getTranslations('ToolsPage');

  const currentPage = Number.parseInt(page, 10);

  if (Number.isNaN(currentPage) || currentPage < 1) {
    notFound();
  }

  // 从数据库获取工具列表
  const { items, total } = await getTools({
    locale,
    page: currentPage,
    pageSize: TOOLS_PER_PAGE,
    published: true,
  });

  const totalPages = Math.ceil(total / TOOLS_PER_PAGE);

  if (currentPage > totalPages && totalPages > 0) {
    notFound();
  }

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
      featured: item.featured || false,
      published: item.published || true,
    },
  }));

  return (
    <div className="relative min-h-screen py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />

      {/* Decorative blobs */}
      <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-gradient-to-br from-[#0052ff]/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-[#3d8bff]/5 to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="text-center mb-12 lg:mb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 rounded-full mb-5">
            <Sparkles className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
            <span className="text-sm text-[#0052ff] dark:text-[#3d8bff] font-semibold uppercase tracking-wider">
              {t('badge')}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight mb-5">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('title')}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-[#64748b] dark:text-[#94a3b8] text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed">
            {t('description')}
          </p>
        </div>

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
