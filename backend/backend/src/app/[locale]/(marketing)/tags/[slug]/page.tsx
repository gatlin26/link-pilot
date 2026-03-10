/**
 * @file tags/[slug]/page.tsx
 * @description 标签详情页面 - 展示标签信息和相关工具
 */

import {
  getAllTagSlugs,
  getRelatedTags,
  getTagBySlug,
  getToolsByTagSlug,
} from '@/actions/tags/get-tags';
import { MultipleSchemaRenderer } from '@/components/schema/schema-renderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MIN_TOOLS_FOR_PUBLISH } from '@/config/tag-whitelist';
import { LOCALES } from '@/i18n/routing';
import { constructMetadata } from '@/lib/metadata';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateItemListSchema,
} from '@/lib/schema';
import { getUrlWithLocale } from '@/lib/urls/urls';
import {
  ArrowLeft,
  ExternalLink,
  Tag as TagIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

// ISR: 每6小时重新验证
export const revalidate = 21600;

interface TagDetailPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const slugs = await getAllTagSlugs();
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
}: TagDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const tag = await getTagBySlug(slug, locale);

  if (!tag) {
    return {
      title: 'Tag Not Found',
    };
  }

  // 获取工具数量用于 metadata
  const tools = await getToolsByTagSlug(slug, locale);

  const title =
    locale === 'zh'
      ? `${tag.name} AI 工具推荐 2026 | BuildWay`
      : `Best ${tag.name} AI Tools 2026 | BuildWay`;

  const description =
    tag.description ||
    (locale === 'zh'
      ? `发现最佳 ${tag.name} AI 工具。比较 ${tools.length}+ 个工具的功能、定价和评价，找到最适合您需求的 ${tag.name} 解决方案。`
      : `Discover the best ${tag.name} AI tools. Compare ${tools.length}+ tools with features, pricing, and reviews. Find the perfect ${tag.name} solution for your needs.`);

  return constructMetadata({
    title,
    description,
    canonicalUrl: getUrlWithLocale(`/tags/${slug}`, locale),
    locale: locale as Locale,
    robots: {
      index: true,
      follow: true,
    },
  });
}

export default async function TagDetailPage({ params }: TagDetailPageProps) {
  const { locale, slug } = await params;
  const t = await getTranslations('tags');

  // 获取标签信息（指定语言）
  const tag = await getTagBySlug(slug, locale);
  if (!tag) {
    notFound();
  }

  // 检查工具数量：必须 >= 5
  if (tag.usageCount < MIN_TOOLS_FOR_PUBLISH) {
    notFound();
  }

  // 获取标签下的工具
  const tools = await getToolsByTagSlug(slug, locale);

  // 获取相关标签
  const relatedTags = await getRelatedTags(slug, tag.category, locale, 6);

  // 生成 Schema
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: getUrlWithLocale('/', locale) },
    { name: 'Tags', url: getUrlWithLocale('/tags', locale) },
    { name: tag.name, url: getUrlWithLocale(`/tags/${slug}`, locale) },
  ]);

  const collectionPageSchema = generateCollectionPageSchema(
    tag,
    tools.length,
    locale as Locale
  );

  const itemListSchema = generateItemListSchema(
    tools.map((tool) => ({
      name: tool.name,
      slug: tool.slug,
      description: tool.translations.find((t) => t.locale === locale)
        ?.description,
    })),
    locale as Locale
  );

  return (
    <>
      <MultipleSchemaRenderer
        schemas={[breadcrumbSchema, collectionPageSchema, itemListSchema]}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 返回按钮 */}
        <Link href={getUrlWithLocale('/tags', locale)}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 size-4" />
            {locale === 'zh' ? '返回标签列表' : 'Back to Tags'}
          </Button>
        </Link>

        {/* 标签头部 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-4xl font-bold">
              {locale === 'zh'
                ? `${tag.name} AI 工具推荐 2026`
                : `Best ${tag.name} AI Tools 2026`}
            </h1>
          </div>

          {tag.description && (
            <p className="text-lg text-muted-foreground max-w-3xl">
              {tag.description}
            </p>
          )}

          <div className="flex items-center gap-4 mt-4">
            {tag.category && <Badge variant="outline">{tag.category}</Badge>}
            <span className="text-sm text-muted-foreground">
              {tools.length} {locale === 'zh' ? '个工具' : 'tools'}
            </span>
          </div>
        </div>

        {/* Content 区域（如果存在） */}
        {tag.content && (
          <div className="prose dark:prose-invert max-w-none mb-8 border-l-4 border-primary pl-6">
            <ReactMarkdown>{tag.content}</ReactMarkdown>
          </div>
        )}

        {/* 工具列表标题 */}
        <h2 className="text-2xl font-semibold mb-6">
          {locale === 'zh'
            ? `${tag.name} 工具 (${tools.length})`
            : `${tag.name} Tools (${tools.length})`}
        </h2>
        {tools.length === 0 ? (
          <div className="text-center py-12">
            <TagIcon className="mx-auto size-12 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">
              {locale === 'zh' ? '暂无工具' : 'No tools found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => {
              const translation =
                tool.translations.find((t) => t.locale === locale) ||
                tool.translations[0];

              return (
                <Link
                  key={tool.id}
                  href={getUrlWithLocale(`/tools/${tool.slug}`, locale)}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        {tool.iconUrl && (
                          <Image
                            src={tool.iconUrl}
                            alt={tool.name}
                            width={48}
                            height={48}
                            className="rounded-lg"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg line-clamp-1">
                            {tool.name}
                          </CardTitle>
                          {translation && (
                            <CardDescription className="line-clamp-2 mt-1">
                              {translation.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {tool.starRating && (
                            <div className="flex items-center gap-1">
                              <span>⭐</span>
                              <span>{tool.starRating}</span>
                            </div>
                          )}
                          {tool.mv && (
                            <span>
                              {tool.mv}M {locale === 'zh' ? '访问' : 'visits'}
                            </span>
                          )}
                        </div>
                        <ExternalLink className="size-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* 相关标签推荐 */}
        {relatedTags.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">
              {locale === 'zh' ? '相关标签' : 'Related Tags'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {relatedTags.map((relatedTag) => (
                <Link
                  key={relatedTag.id}
                  href={getUrlWithLocale(`/tags/${relatedTag.slug}`, locale)}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow hover:border-primary">
                    <CardHeader>
                      <CardTitle className="text-base">
                        {relatedTag.name}
                      </CardTitle>
                      {relatedTag.description && (
                        <CardDescription className="line-clamp-2 text-sm">
                          {relatedTag.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TagIcon className="size-3" />
                        <span>
                          {relatedTag.usageCount || 0}{' '}
                          {locale === 'zh' ? '个工具' : 'tools'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
