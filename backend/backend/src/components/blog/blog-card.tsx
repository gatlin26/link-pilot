import { Skeleton } from '@/components/ui/skeleton';
import { LocaleLink } from '@/i18n/navigation';
import { formatDate } from '@/lib/formatter';
import {
  type SerializableBlogPost,
  authorSource,
  categorySource,
} from '@/lib/source';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import Image from 'next/image';
import { PremiumBadge } from '../premium/premium-badge';
import BlogImage from './blog-image';

interface BlogCardProps {
  locale: string;
  post: SerializableBlogPost;
  variant?: 'default' | 'hero';
  readTimeLabel?: string;
  readTimeShortLabel?: string;
}

// Calculate reading time based on content length (rough estimate: 200 words per minute)
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

export default function BlogCard({
  locale,
  post,
  variant = 'default',
  readTimeLabel = '{minutes} min read',
  readTimeShortLabel = '{minutes} min',
}: BlogCardProps) {
  const { date, title, description, image, author, categories } = post.data;
  const publishDate = formatDate(new Date(date));
  const blogAuthor = authorSource.getPage([author], locale);
  const blogCategories = categorySource
    .getPages(locale)
    .filter((category) => categories.includes(category.slugs[0] ?? ''));

  // Calculate reading time from post content
  const readingTime = post.data.body
    ? calculateReadingTime(post.data.body.toString())
    : 5;

  if (variant === 'hero') {
    return (
      <LocaleLink href={`/blog/${post.slugs}`} className="block">
        <article className="group flex flex-col md:flex-row gap-6 border border-border rounded-2xl overflow-hidden transition-all duration-300 ease-in-out hover:border-accent hover:shadow-lg hover:-translate-y-1">
          {/* Image - 40% width on desktop */}
          <div className="relative md:w-2/5 aspect-[3/2] overflow-hidden">
            <BlogImage
              src={image}
              alt={title || 'image for blog post'}
              title={title || 'image for blog post'}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>

          {/* Content - 60% width on desktop */}
          <div className="flex-1 p-6 flex flex-col justify-between">
            <div>
              {/* Categories as pills */}
              {blogCategories && blogCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {blogCategories.map((category, index) => (
                    <span
                      key={`${category?.slugs[0]}-${index}`}
                      className="px-3 py-1 text-xs font-medium uppercase tracking-wider bg-accent/10 text-accent rounded-full font-mono"
                    >
                      {category?.data.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Title with Sora font */}
              <h2 className="text-2xl md:text-3xl font-semibold line-clamp-2 mb-3 font-heading group-hover:text-accent transition-colors">
                {title}
              </h2>

              {/* Premium badge inline */}
              {post.data.premium && (
                <div className="inline-block mb-3">
                  <PremiumBadge size="sm" />
                </div>
              )}

              {/* Description */}
              {description && (
                <p className="text-base text-muted-foreground line-clamp-3 leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            {/* Author and meta info */}
            <div className="flex items-center gap-4 mt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="relative h-6 w-6 shrink-0">
                  {blogAuthor?.data.avatar && (
                    <Image
                      src={blogAuthor?.data.avatar}
                      alt={`avatar for ${blogAuthor?.data.name}`}
                      className="rounded-full object-cover border"
                      fill
                    />
                  )}
                </div>
                <span className="font-medium">{blogAuthor?.data.name}</span>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <time dateTime={date} className="font-mono">
                {publishDate}
              </time>
              <span className="text-muted-foreground/50">•</span>
              <div className="flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                <span>
                  {readTimeLabel.replace('{minutes}', String(readingTime))}
                </span>
              </div>
            </div>
          </div>
        </article>
      </LocaleLink>
    );
  }

  // Default card variant
  return (
    <LocaleLink href={`/blog/${post.slugs}`} className="block h-full">
      <article className="group flex flex-col border border-border rounded-2xl overflow-hidden h-full transition-all duration-200 ease-out hover:border-accent hover:shadow-lg hover:-translate-y-1">
        {/* Image container */}
        <div className="relative aspect-16/9 overflow-hidden">
          <BlogImage
            src={image}
            alt={title || 'image for blog post'}
            title={title || 'image for blog post'}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Premium badge */}
          {post.data.premium && (
            <div className="absolute top-3 right-3 z-20">
              <PremiumBadge size="sm" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col justify-between p-5 flex-1">
          <div>
            {/* Categories as pills */}
            {blogCategories && blogCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {blogCategories.map((category, index) => (
                  <span
                    key={`${category?.slugs[0]}-${index}`}
                    className="px-2 py-1 text-xs font-medium uppercase tracking-wider bg-accent/10 text-accent rounded-full font-mono"
                  >
                    {category?.data.name}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h3 className="text-lg font-semibold line-clamp-2 mb-2 font-heading group-hover:text-accent transition-colors">
              {title}
            </h3>

            {/* Description */}
            {description && (
              <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="relative h-6 w-6 shrink-0">
                {blogAuthor?.data.avatar && (
                  <Image
                    src={blogAuthor?.data.avatar}
                    alt={`avatar for ${blogAuthor?.data.name}`}
                    className="rounded-full object-cover border"
                    fill
                  />
                )}
              </div>
              <span className="font-medium truncate">
                {blogAuthor?.data.name}
              </span>
            </div>
            <span className="text-muted-foreground/50">•</span>
            <time dateTime={date} className="font-mono truncate">
              {publishDate}
            </time>
            <span className="text-muted-foreground/50">•</span>
            <div className="flex items-center gap-1 font-mono whitespace-nowrap">
              <Clock className="w-3 h-3" />
              <span>
                {readTimeShortLabel.replace('{minutes}', String(readingTime))}
              </span>
            </div>
          </div>
        </div>
      </article>
    </LocaleLink>
  );
}

export function BlogCardSkeleton() {
  return (
    <div className="border border-border rounded-2xl overflow-hidden h-full">
      <div className="overflow-hidden relative aspect-16/9 w-full">
        <Skeleton className="h-full w-full rounded-b-none" />
      </div>
      <div className="p-4 flex flex-col justify-between flex-1">
        <div>
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-4" />
        </div>
        <div className="pt-4 border-t border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}
