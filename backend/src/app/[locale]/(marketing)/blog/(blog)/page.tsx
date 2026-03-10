import BlogGridWithPagination from '@/components/blog/blog-grid-with-pagination';
import { websiteConfig } from '@/config/website';
import { LOCALES } from '@/i18n/routing';
import { constructMetadata } from '@/lib/metadata';
import { blogSource, toSerializableBlogPost } from '@/lib/source';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: BlogPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({ locale, namespace: 'BlogPage' });

  return constructMetadata({
    title: `${pt('title')} | ${t('title')}`,
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/blog', locale),
  });
}

interface BlogPageProps {
  params: Promise<{
    locale: Locale;
  }>;
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale } = await params;
  // 按当前语言过滤：只展示该 locale 下的文章列表
  const localePosts = blogSource.getPages(locale);
  const publishedPosts = localePosts.filter((post) => post.data.published);
  const sortedPosts = publishedPosts.sort((a, b) => {
    return new Date(b.data.date).getTime() - new Date(a.data.date).getTime();
  });
  const currentPage = 1;
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
