/**
 * @file tools/[slug]/page.tsx
 * @description Tool detail page with enhanced formatting and content display (database-backed with ISR)
 * @author yiangto
 * @date 2026-02-02
 */

import { getToolBySlug } from '@/actions/tools/get-tool';
import { getAllToolSlugs } from '@/actions/tools/get-tools';
import { getToolReviewsForSchema } from '@/actions/tools/reviews';
import { MultipleSchemaRenderer } from '@/components/schema/schema-renderer';
import { RelatedToolsSection } from '@/components/tools/related-tools-section';
import { ToolReviews } from '@/components/tools/tool-reviews';
import { Button } from '@/components/ui/button';
import { LOCALES } from '@/i18n/routing';
import { constructMetadata } from '@/lib/metadata';
import {
  generateBreadcrumbSchema,
  generateToolProductSchema,
} from '@/lib/schema';
import { sortToolTagsByCategory } from '@/lib/tool-tags';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { addUtmParams } from '@/lib/utils';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import {
  de,
  enUS,
  es,
  fr,
  ja,
  ko,
  pt as ptBR,
  vi,
  zhCN,
  zhTW,
} from 'date-fns/locale';
import { ArrowLeft, Calendar, ExternalLink, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

// ISR: 每6小时重新验证（优化成本）
// 配合按需重新验证（revalidatePath），更新时立即生效
export const revalidate = 21600;

interface ToolDetailPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const slugs = await getAllToolSlugs();
  const params: { locale: string; slug: string }[] = [];

  for (const locale of LOCALES) {
    for (const slug of slugs) {
      params.push({ locale, slug });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: ToolDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const tool = await getToolBySlug(slug, locale);

  if (!tool) {
    const t = await getTranslations({ locale, namespace: 'ToolsPage' });
    return {
      title: t('toolNotFound'),
    };
  }

  return constructMetadata({
    title: `${tool.name} - ${tool.title}`,
    description: tool.description || undefined,
    canonicalUrl: getUrlWithLocale(`/tools/${slug}`, locale),
    image: tool.thumbnailUrl || undefined,
    locale: locale as import('next-intl').Locale,
  });
}

export default async function ToolDetailPage({ params }: ToolDetailPageProps) {
  const { locale, slug } = await params;
  const t = await getTranslations('ToolsPage');

  const tool = await getToolBySlug(slug, locale);

  if (!tool || !tool.published) {
    notFound();
  }

  // 格式化收录时间
  const collectionDate = tool.collectionTime
    ? new Date(tool.collectionTime)
    : new Date();
  const dateFnsLocaleMap: Record<string, Locale> = {
    en: enUS,
    zh: zhCN,
    'zh-TW': zhTW,
    ko,
    ja,
    pt: ptBR,
    es,
    de,
    fr,
    vi,
  };
  const dateLocale = dateFnsLocaleMap[locale] ?? enUS;
  const formattedDate =
    locale === 'zh' || locale === 'zh-TW' || locale === 'ja'
      ? format(collectionDate, 'yyyy年MM月dd日', { locale: dateLocale })
      : format(collectionDate, 'MMMM dd, yyyy', { locale: dateLocale });

  // 查询真实评论数据用于 JSON-LD 结构化数据
  const schemaReviews = await getToolReviewsForSchema(tool.id);

  const reviewCount = tool.reviewCount || 0;
  const avgRating = tool.avgRating
    ? Number(tool.avgRating)
    : tool.starRating || 5;

  const orderedTagDetails = sortToolTagsByCategory(tool.tagDetails);

  // 生成结构化数据
  const toolUrl = getUrlWithLocale(`/tools/${slug}`, locale);
  const toolImage = tool.thumbnailUrl || tool.imageUrl || '/og-image.png';
  const schemas = [
    generateToolProductSchema(
      tool.name,
      tool.description || '',
      toolUrl,
      toolImage,
      avgRating,
      tool.tags,
      locale,
      reviewCount,
      schemaReviews
        .filter((r) => r.comment)
        .map((r) => ({
          authorName: r.userName,
          ratingValue: r.rating,
          reviewBody: r.comment!,
          datePublished: new Date(r.createdAt).toISOString().split('T')[0],
        }))
    ),
    generateBreadcrumbSchema([
      {
        name: t('title'),
        url: getUrlWithLocale('/tools', locale),
      },
      {
        name: tool.name,
        url: toolUrl,
      },
    ]),
  ];

  return (
    <>
      {/* 结构化数据 */}
      <MultipleSchemaRenderer schemas={schemas} />

      <div className="relative min-h-screen py-24 lg:py-32 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />

        {/* Decorative blobs */}
        <div className="absolute left-0 top-1/4 size-[500px] rounded-full bg-gradient-to-br from-[#0052ff]/5 to-transparent blur-3xl" />
        <div className="absolute bottom-1/4 right-0 size-[400px] rounded-full bg-gradient-to-tl from-[#3d8bff]/5 to-transparent blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-8">
            <Link
              href={`/${locale}/tools`}
              className="inline-flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#0052ff] dark:hover:text-[#3d8bff] transition-colors group"
            >
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-medium">{t('backToTools')}</span>
            </Link>
          </nav>

          {/* Tool Header Section */}
          <div className="mb-14 lg:mb-16">
            {/* Thumbnail */}
            {tool.thumbnailUrl && (
              <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-8 ring-1 ring-[#e2e8f0] dark:ring-[#334155] shadow-xl">
                <Image
                  src={tool.thumbnailUrl}
                  alt={tool.name}
                  fill
                  className="object-cover"
                  priority
                  quality={80}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
              </div>
            )}

            <div className="min-w-0">
              {/* Title and Badge */}
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <h1 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight mb-3">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
                      {tool.name}
                    </span>
                  </h1>
                  {tool.featured && (
                    <div className="inline-flex items-center gap-2">
                      <Sparkles className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
                      <span className="px-3 py-1.5 text-sm font-semibold bg-gradient-to-r from-[#0052ff] to-[#3d8bff] text-white rounded-full shadow-lg">
                        Featured
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="max-w-4xl text-lg lg:text-xl text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                {tool.description}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="inline-flex items-center gap-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
                  <Calendar className="size-4" />
                  <span>
                    {t('collectedOn')} {formattedDate}
                  </span>
                </div>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full border-[#dbe5f1] bg-white/60 px-4 text-[#64748b] shadow-none hover:bg-[#f8fafc] hover:text-[#0f172a] dark:border-[#334155] dark:bg-[#0f172a]/40 dark:text-[#94a3b8] dark:hover:bg-[#1e293b] dark:hover:text-[#f8fafc]"
                >
                  <a
                    href={addUtmParams(tool.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    {t('visitWebsite')}
                  </a>
                </Button>
              </div>
            </div>

            {/* Tags */}
            {tool.tagDetails && tool.tagDetails.length > 0 && (
              <section className="mt-8 rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white/60 dark:bg-[#0f172a]/60 backdrop-blur-sm p-6 md:p-7">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                    {locale === 'zh' || locale === 'zh-TW' ? '标签' : 'Tags'}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {orderedTagDetails.map((tag) => {
                      const className =
                        'inline-flex items-center rounded-full border border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc]/90 dark:bg-[#1e293b]/80 px-3 py-1.5 text-sm font-medium text-[#64748b] dark:text-[#94a3b8] transition-colors';

                      if (tag.status === 'published') {
                        return (
                          <Link
                            key={tag.slug}
                            href={`/${locale}/tags/${tag.slug}`}
                            className={`${className} hover:bg-[#e2e8f0] dark:hover:bg-[#334155]`}
                          >
                            #{tag.name}
                          </Link>
                        );
                      }

                      return (
                        <span key={tag.slug} className={className}>
                          #{tag.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Tool Content Section - Markdown */}
          {tool.introduction && (
            <div
              className="prose prose-slate dark:prose-invert max-w-none
            prose-headings:font-heading prose-headings:tracking-tight
            prose-h2:text-2xl prose-h2:lg:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:font-bold prose-h2:text-[#0f172a] dark:prose-h2:text-[#f8fafc] prose-h2:border-b prose-h2:border-[#e2e8f0] dark:prose-h2:border-[#334155] prose-h2:pb-3
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:font-semibold prose-h3:text-[#1e293b] dark:prose-h3:text-[#e2e8f0]
            prose-h4:text-lg prose-h4:mt-6 prose-h4:mb-3 prose-h4:font-semibold prose-h4:text-[#334155] dark:prose-h4:text-[#cbd5e1]
            prose-p:text-[#64748b] dark:prose-p:text-[#94a3b8] prose-p:leading-relaxed prose-p:text-base prose-p:my-4
            prose-ul:my-6 prose-ul:space-y-3 prose-li:my-0 prose-li:text-[#64748b] dark:prose-li:text-[#94a3b8] prose-li:leading-relaxed prose-li:pl-1
            prose-li>h3:mt-0 prose-li>h3:mb-2 prose-li>h3:text-base prose-li>h3:font-bold prose-li>h3:text-[#0f172a] dark:prose-li>h3:text-[#f8fafc] prose-li>h3:border-0 prose-li>h3:pb-0
            prose-li>h4:mt-0 prose-li>h4:mb-1 prose-li>h4:text-sm prose-li>h4:font-semibold prose-li>h4:text-[#1e293b] dark:prose-li>h4:text-[#e2e8f0]
            prose-ol:my-6 prose-ol:space-y-3 prose-li:marker:text-[#0052ff] dark:prose-li:marker:text-[#3d8bff] prose-li:marker:font-semibold
            prose-strong:text-[#0f172a] dark:prose-strong:text-[#f8fafc] prose-strong:font-semibold
            prose-a:text-[#0052ff] dark:prose-a:text-[#3d8bff] prose-a:no-underline prose-a:border-b prose-a:border-[#0052ff]/30 dark:prose-a:border-[#3d8bff]/30 hover:prose-a:border-[#0052ff] dark:hover:prose-a:border-[#3d8bff] prose-a:font-medium prose-a:transition-colors
            prose-blockquote:border-l-4 prose-blockquote:border-l-[#0052ff] dark:prose-blockquote:border-l-[#3d8bff] prose-blockquote:bg-[#f8fafc] dark:prose-blockquote:bg-[#1e293b] prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:my-6 prose-blockquote:shadow-sm
            prose-code:text-[#0052ff] dark:prose-code:text-[#3d8bff] prose-code:bg-[#f1f5f9] dark:prose-code:bg-[#1e293b] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium
            prose-pre:bg-[#0f172a] dark:prose-pre:bg-[#1e293b] prose-pre:border prose-pre:border-[#334155] prose-pre:rounded-lg prose-pre:p-4 prose-pre:shadow-lg
            prose-hr:border-[#e2e8f0] dark:prose-hr:border-[#334155] prose-hr:my-8
            prose-table:my-6 prose-table:w-full prose-table:border-collapse
            prose-th:border prose-th:border-[#e2e8f0] dark:prose-th:border-[#334155] prose-th:bg-[#f8fafc] dark:prose-th:bg-[#1e293b] prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
            prose-td:border prose-td:border-[#e2e8f0] dark:prose-td:border-[#334155] prose-td:px-4 prose-td:py-2"
            >
              <ReactMarkdown>{tool.introduction}</ReactMarkdown>
            </div>
          )}

          {/* Reviews Section */}
          <ToolReviews
            toolId={tool.id}
            toolName={tool.name}
            initialAvgRating={avgRating}
            initialReviewCount={reviewCount}
          />

          {/* Similar Tools Section */}
          <RelatedToolsSection toolId={tool.id} locale={locale} limit={4} />
        </div>
      </div>
    </>
  );
}
