import { DEFAULT_LOCALE, LOCALES } from '@/i18n/routing';
import { type InferPageType, loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { author, blog, category, changelog, pages, tools } from '../../.source';

/**
 * I18n configuration for content sources
 */
const i18nConfig = {
  defaultLanguage: DEFAULT_LOCALE,
  languages: LOCALES,
};

/**
 * Changelog source
 */
export const changelogSource = loader({
  baseUrl: '/changelog',
  i18n: i18nConfig,
  source: createMDXSource(changelog),
});

/**
 * Pages source
 *
 * TODO: how to set the baseUrl for pages?
 */
export const pagesSource = loader({
  baseUrl: '/pages',
  i18n: i18nConfig,
  source: createMDXSource(pages),
});

/**
 * Blog authors source
 */
export const authorSource = loader({
  baseUrl: '/author',
  i18n: i18nConfig,
  source: createMDXSource(author),
});

/**
 * Blog categories source
 */
export const categorySource = loader({
  baseUrl: '/category',
  i18n: i18nConfig,
  source: createMDXSource(category),
});

/**
 * Blog posts source
 * 多语言：getPages(locale) / getPage(slug, locale) 按当前语言过滤，只展示对应 locale 的文章
 */
export const blogSource = loader({
  baseUrl: '/blog',
  i18n: i18nConfig,
  source: createMDXSource(blog),
  transformers: [
    (page) => {
      // console.log('page', page);
      return page;
    },
  ],
});

/**
 * AI Tools source
 */
export const toolsSource = loader({
  baseUrl: '/tools',
  i18n: i18nConfig,
  source: createMDXSource(tools),
});

export type ChangelogType = InferPageType<typeof changelogSource>;
export type PagesType = InferPageType<typeof pagesSource>;
export type AuthorType = InferPageType<typeof authorSource>;
export type CategoryType = InferPageType<typeof categorySource>;
export type BlogType = InferPageType<typeof blogSource>;
export type ToolType = InferPageType<typeof toolsSource>;

/**
 * Serializable blog post data for client components
 * Only includes the necessary fields for rendering
 */
export interface SerializableBlogPost {
  slugs: string[];
  locale: string;
  data: {
    date: string;
    title: string;
    description?: string;
    image: string;
    author: string;
    categories: string[];
    premium?: boolean;
    body?: string;
  };
}

/**
 * Serializable tool data for client components
 * Only includes the necessary fields for rendering
 * 支持 MDX 和数据库两种数据源
 */
export interface SerializableTool {
  data: {
    id: string;
    slug?: string; // 数据库使用 slug
    name: string;
    title: string;
    description: string;
    href: string;
    url: string;
    image: string;
    thumbnailUrl: string;
    collectionTime: string;
    starRating: number;
    category: string[];
    tags: string[];
    tagDetails?: { slug: string; name: string }[]; // 添加标签详情
    featured: boolean;
    published: boolean;
    badge?: string;
  };
}

/**
 * Convert BlogType to SerializableBlogPost
 * This removes complex objects that can't be serialized for client components
 */
export function toSerializableBlogPost(post: BlogType): SerializableBlogPost {
  return {
    slugs: post.slugs,
    locale: post.locale ?? DEFAULT_LOCALE,
    data: {
      date: post.data.date,
      title: post.data.title,
      description: post.data.description,
      image: post.data.image,
      author: post.data.author,
      categories: post.data.categories,
      premium: post.data.premium,
      body: post.data.body ? post.data.body.toString() : undefined,
    },
  };
}

/**
 * Convert ToolType to SerializableTool
 * This removes complex objects that can't be serialized for client components
 */
export function toSerializableTool(tool: ToolType): SerializableTool {
  return {
    data: {
      id: tool.data.id,
      name: tool.data.name,
      title: tool.data.title,
      description: tool.data.description,
      href: tool.data.href,
      url: tool.data.url,
      image: tool.data.image ?? '',
      thumbnailUrl: tool.data.thumbnailUrl ?? '',
      collectionTime: tool.data.collectionTime,
      starRating: tool.data.starRating,
      category: Array.isArray(tool.data.category) ? tool.data.category : [],
      tags: Array.isArray(tool.data.tags) ? tool.data.tags : [],
      featured: tool.data.featured ?? false,
      published: tool.data.published ?? false,
      badge: tool.data.badge,
    },
  };
}
