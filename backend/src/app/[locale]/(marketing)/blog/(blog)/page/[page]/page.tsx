import BlogGridWithPagination from '@/components/blog/blog-grid-with-pagination';
import { websiteConfig } from '@/config/website';
import { LOCALES } from '@/i18n/routing';
import { constructMetadata } from '@/lib/metadata';
import { blogSource, toSerializableBlogPost } from '@/lib/source';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export function generateStaticParams() {
  const paginationSize = websiteConfig.blog.paginationSize;
  const params: { locale: string; page: string }[] = [];
  for (const locale of LOCALES) {
    const publishedPosts = blogSource
      .getPages(locale)
      .filter((post) => post.data.published);
    const totalPages = Math.max(
      1,
      Math.ceil(publishedPosts.length / paginationSize)
    );
    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber++) {
      params.push({ locale, page: String(pageNumber) });
    }
  }
  return params;
}

export async function generateMetadata({ params }: BlogListPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({ locale, namespace: 'BlogPage' });

  return constructMetadata({
    title: `${pt('title')} | ${t('title')}`,
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/blog', locale),
  });
}

interface BlogListPageProps {
  params: Promise<{
    locale: Locale;
    page: string;
  }>;
}

export default async function BlogListPage({ params }: BlogListPageProps) {
  const { locale, page } = await params;
  // 按当前语言过滤：只展示该 locale 下的文章列表
  const localePosts = blogSource.getPages(locale);
  const publishedPosts = localePosts.filter((post) => post.data.published);
  const sortedPosts = publishedPosts.sort((a, b) => {
    return new Date(b.data.date).getTime() - new Date(a.data.date).getTime();
  });
  const currentPage = Number(page);
  const blogPageSize = websiteConfig.blog.paginationSize;
  const paginatedLocalePosts = sortedPosts.slice(
    (currentPage - 1) * blogPageSize,
    currentPage * blogPageSize
  );
  const totalPages = Math.ceil(sortedPosts.length / blogPageSize);

  const t = await getTranslations({ locale, namespace: 'BlogPage' });

  // Convert to serializable format for client components
  const serializablePosts = paginatedLocalePosts.map((p) =>
    toSerializableBlogPost(p)
  );

  return (
    <BlogGridWithPagination
      locale={locale}
      posts={serializablePosts}
      totalPages={totalPages}
      routePrefix={'/blog'}
      currentPage={currentPage}
      readTimeLabel={t.raw('readTime')}
      readTimeShortLabel={t.raw('readTimeShort')}
    />
  );
}
