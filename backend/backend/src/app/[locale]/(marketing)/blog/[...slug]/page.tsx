import AllPostsButton from '@/components/blog/all-posts-button';
import BlogGrid from '@/components/blog/blog-grid';
import { ReadingProgress } from '@/components/blog/reading-progress';
import { getMDXComponents } from '@/components/docs/mdx-components';
import { PremiumBadge } from '@/components/premium/premium-badge';
import { PremiumGuard } from '@/components/premium/premium-guard';
import { SchemaRenderer } from '@/components/schema/schema-renderer';
import { websiteConfig } from '@/config/website';
import { LocaleLink } from '@/i18n/navigation';
import { formatDate } from '@/lib/formatter';
import { constructMetadata } from '@/lib/metadata';
import { checkPremiumAccess } from '@/lib/premium-access';
import { generateArticleSchema } from '@/lib/schema';
import { getSession } from '@/lib/server';
import {
  type BlogType,
  authorSource,
  blogSource,
  categorySource,
  toSerializableBlogPost,
} from '@/lib/source';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
import { CalendarIcon, FileTextIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import '@/styles/mdx.css';

/**
 * 获取相关文章：按当前文章 locale 过滤，只从同语言文章中随机选取
 * max size is websiteConfig.blog.relatedPostsSize
 */
async function getRelatedPosts(post: BlogType) {
  const relatedPosts = blogSource
    .getPages(post.locale)
    .filter((p) => p.data.published)
    .filter((p) => p.slugs.join('/') !== post.slugs.join('/'))
    .sort(() => Math.random() - 0.5)
    .slice(0, websiteConfig.blog.relatedPostsSize);

  return relatedPosts;
}

export function generateStaticParams() {
  return blogSource
    .getPages()
    .filter((post) => post.data.published)
    .flatMap((post) => {
      return {
        locale: post.locale,
        slug: post.slugs,
      };
    });
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata | undefined> {
  const { locale, slug } = await params;
  const post = blogSource.getPage(slug, locale);
  if (!post) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return constructMetadata({
    title: `${post.data.title} | ${t('title')}`,
    description: post.data.description,
    canonicalUrl: getUrlWithLocale(`/blog/${slug}`, locale),
    image: post.data.image,
  });
}

interface BlogPostPageProps {
  params: Promise<{
    locale: Locale;
    slug: string[];
  }>;
}

export default async function BlogPostPage(props: BlogPostPageProps) {
  const { locale, slug } = await props.params;
  const post = blogSource.getPage(slug, locale);
  if (!post) {
    notFound();
  }

  const { date, title, description, image, author, categories, premium } =
    post.data;
  const publishDate = formatDate(new Date(date));

  const blogAuthor = authorSource.getPage([author], locale);
  const blogCategories = categorySource
    .getPages(locale)
    .filter((category) => categories.includes(category.slugs[0] ?? ''));

  // Check premium access for premium posts
  const session = await getSession();
  const hasPremiumAccess =
    premium && session?.user?.id
      ? await checkPremiumAccess(session.user.id)
      : !premium; // Non-premium posts are always accessible

  const MDX = post.data.body;

  // getTranslations may cause error DYNAMIC_SERVER_USAGE, so we set dynamic to force-static
  const t = await getTranslations('BlogPage');

  // get related posts
  const relatedPosts = await getRelatedPosts(post);

  // Convert to serializable format for client components
  const serializableRelatedPosts = relatedPosts.map((p) =>
    toSerializableBlogPost(p)
  );

  return (
    <>
      {/* Article Schema for SEO */}
      <SchemaRenderer
        schema={generateArticleSchema(
          title,
          description || '',
          image,
          new Date(date),
          new Date(date),
          blogAuthor?.data.name || 'EditPhoto AI',
          blogAuthor?.data.avatar,
          slug,
          locale
        )}
      />

      {/* Reading progress bar */}
      <ReadingProgress />

      <div className="flex flex-col">
        {/* Hero section with image background */}
        <div className="relative -mx-4 md:-mx-6 lg:-mx-8 mb-12">
          <div className="relative h-[40vh] min-h-[320px] overflow-hidden">
            {image && (
              <>
                <Image
                  src={image}
                  alt={title || 'image for blog post'}
                  title={title || 'image for blog post'}
                  loading="eager"
                  fill
                  className="object-cover"
                  style={{ filter: 'contrast(1.1) saturate(0.9)' }}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              </>
            )}

            {/* Hero content overlay */}
            <div className="absolute inset-0 flex items-end">
              <div className="container mx-auto px-4 md:px-6 lg:px-8 pb-12">
                <div className="max-w-4xl">
                  {/* Categories */}
                  {blogCategories && blogCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {blogCategories.map((category, index) => (
                        <span
                          key={`${category?.slugs[0]}-${index}`}
                          className="px-3 py-1 text-xs font-medium uppercase tracking-wider bg-accent/90 text-white rounded-full font-mono"
                        >
                          {category?.data.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Title */}
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white leading-tight tracking-tight font-heading mb-4">
                    {title}
                  </h1>

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-white/90">
                    {blogAuthor && (
                      <div className="flex items-center gap-2">
                        <div className="relative h-8 w-8 shrink-0">
                          {blogAuthor.data.avatar && (
                            <Image
                              src={blogAuthor.data.avatar}
                              alt={`avatar for ${blogAuthor.data.name}`}
                              className="rounded-full object-cover border-2 border-white/50"
                              fill
                            />
                          )}
                        </div>
                        <span className="font-medium">
                          {blogAuthor.data.name}
                        </span>
                      </div>
                    )}
                    <span className="text-white/50">•</span>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="size-4" />
                      <time className="font-mono">{publishDate}</time>
                    </div>
                    {premium && (
                      <>
                        <span className="text-white/50">•</span>
                        <PremiumBadge size="sm" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content - single column centered */}
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="max-w-[680px] mx-auto">
            {/* Description */}
            {description && (
              <p className="text-xl text-muted-foreground leading-relaxed mb-12">
                {description}
              </p>
            )}

            {/* Article content */}
            <article className="prose prose-lg max-w-none">
              <PremiumGuard
                isPremium={!!premium}
                canAccess={hasPremiumAccess}
                className="max-w-none"
              >
                <MDX components={getMDXComponents()} />
              </PremiumGuard>
            </article>

            {/* Back to all posts */}
            <div className="flex items-center justify-start my-16">
              <AllPostsButton />
            </div>
          </div>
        </div>

        {/* Floating TOC - desktop only */}
        {post.data.toc && (
          <aside className="hidden xl:block fixed right-8 top-32 w-64 max-h-[calc(100vh-10rem)] overflow-y-auto">
            <div className="sticky top-32">
              <InlineTOC
                items={post.data.toc}
                open={true}
                defaultOpen={true}
                className="bg-card/80 backdrop-blur-sm border rounded-lg shadow-sm"
              />
            </div>
          </aside>
        )}

        {/* Related posts section */}
        {relatedPosts && relatedPosts.length > 0 && (
          <div className="container mx-auto px-4 md:px-6 lg:px-8 mt-16">
            <div className="max-w-[1200px] mx-auto">
              <div className="flex items-center gap-2 mb-8">
                <FileTextIcon className="size-5 text-accent" />
                <h2 className="text-2xl font-semibold font-heading text-accent">
                  {t('morePosts')}
                </h2>
              </div>

              <BlogGrid
                posts={serializableRelatedPosts}
                locale={locale}
                showHero={false}
                readTimeLabel={t('readTime')}
                readTimeShortLabel={t('readTimeShort')}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
