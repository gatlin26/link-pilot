/**
 * @file tags/page.tsx
 * @description 标签列表页面 - 展示所有已发布的标签
 */

import { getAllPublishedTags } from '@/actions/tags/get-tags';
import { MultipleSchemaRenderer } from '@/components/schema/schema-renderer';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  generateBreadcrumbSchema,
  generateTagsListCollectionPageSchema,
} from '@/lib/schema';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { Tag as TagIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

// ISR: 每6小时重新验证
export const revalidate = 21600;

interface TagsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({
  params,
}: TagsPageProps): Promise<Metadata> {
  const { locale } = await params;

  const title =
    locale === 'zh'
      ? 'AI 工具标签与分类 - 按类型、定价、平台浏览 | BuildWay'
      : 'AI Tool Tags & Categories - Browse by Type, Pricing & Platform | BuildWay';

  const description =
    locale === 'zh'
      ? '浏览所有 AI 工具标签，按类型、定价、平台等分类查找工具。探索数百个标签，找到最适合您需求的 AI 工具。'
      : 'Browse all AI tool tags and categories. Find tools by type, pricing, platform and more. Explore hundreds of tags to find the perfect AI tool for your needs.';

  return {
    title,
    description,
  };
}

export default async function TagsPage({ params }: TagsPageProps) {
  const { locale } = await params;
  const t = await getTranslations('tags');

  // 获取所有已发布的标签（指定语言）
  const tags = await getAllPublishedTags(locale);

  // 按分类分组
  const tagsByCategory = tags.reduce(
    (acc, tag) => {
      const category = tag.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tag);
      return acc;
    },
    {} as Record<string, typeof tags>
  );

  const categoryNames: Record<string, { en: string; zh: string }> = {
    type: { en: 'Type', zh: '类型' },
    pricing: { en: 'Pricing', zh: '定价' },
    platform: { en: 'Platform', zh: '平台' },
    feature: { en: 'Feature', zh: '功能' },
    general: { en: 'General', zh: '通用' },
    other: { en: 'Other', zh: '其他' },
  };

  // 生成 Schema
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: getUrlWithLocale('/', locale) },
    { name: 'Tags', url: getUrlWithLocale('/tags', locale) },
  ]);

  const collectionPageSchema = generateTagsListCollectionPageSchema(
    tags.length,
    locale as Locale
  );

  return (
    <>
      <MultipleSchemaRenderer
        schemas={[breadcrumbSchema, collectionPageSchema]}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 页面头部 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            {locale === 'zh'
              ? 'AI 工具标签与分类'
              : 'AI Tool Tags & Categories'}
          </h1>
          <p className="text-lg text-muted-foreground">
            {locale === 'zh'
              ? '按标签浏览 AI 工具，快速找到您需要的工具类型'
              : 'Browse AI tools by tags to quickly find the type of tools you need'}
          </p>
        </div>

        {/* 标签统计 */}
        <div className="mb-8">
          <Badge variant="secondary" className="text-sm">
            {tags.length} {locale === 'zh' ? '个标签' : 'tags'}
          </Badge>
        </div>

        {/* 按分类展示标签 */}
        {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
          <div key={category} className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">
              {categoryNames[category]?.[locale as 'en' | 'zh'] || category}{' '}
              {locale === 'zh' ? '标签' : 'Tags'} ({categoryTags.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoryTags.map((tag) => (
                <Link
                  key={tag.id}
                  href={getUrlWithLocale(`/tags/${tag.slug}`, locale)}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow hover:border-primary">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{tag.name}</CardTitle>
                      </div>
                      {tag.description && (
                        <CardDescription className="line-clamp-2">
                          {tag.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TagIcon className="size-4" />
                        <span>
                          {tag.usageCount || 0}{' '}
                          {locale === 'zh' ? '个工具' : 'tools'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* 空状态 */}
        {tags.length === 0 && (
          <div className="text-center py-12">
            <TagIcon className="mx-auto size-12 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">
              {locale === 'zh' ? '暂无标签' : 'No tags found'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
