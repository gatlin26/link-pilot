import BlogCard, { BlogCardSkeleton } from '@/components/blog/blog-card';
import { websiteConfig } from '@/config/website';
import type { SerializableBlogPost } from '@/lib/source';

interface BlogGridProps {
  locale: string;
  posts: SerializableBlogPost[];
  showHero?: boolean;
  readTimeLabel?: string;
  readTimeShortLabel?: string;
}

export default function BlogGrid({
  locale,
  posts,
  showHero = false,
  readTimeLabel,
  readTimeShortLabel,
}: BlogGridProps) {
  if (!posts || posts.length === 0) {
    return null;
  }

  // If showHero is true and we have posts, display first post as hero
  if (showHero && posts.length > 0) {
    const [heroPost, ...remainingPosts] = posts;

    return (
      <div className="space-y-12">
        {/* Hero post - full width */}
        <BlogCard
          key={heroPost.slugs.join('/')}
          locale={locale}
          post={heroPost}
          variant="hero"
          readTimeLabel={readTimeLabel}
          readTimeShortLabel={readTimeShortLabel}
        />

        {/* Remaining posts in 2-column grid */}
        {remainingPosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {remainingPosts.map((post) => (
              <BlogCard
                key={post.slugs.join('/')}
                locale={locale}
                post={post}
                variant="default"
                readTimeLabel={readTimeLabel}
                readTimeShortLabel={readTimeShortLabel}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default grid layout without hero
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      {posts.map((post) => (
        <BlogCard
          key={post.slugs.join('/')}
          locale={locale}
          post={post}
          variant="default"
          readTimeLabel={readTimeLabel}
          readTimeShortLabel={readTimeShortLabel}
        />
      ))}
    </div>
  );
}

export function BlogGridSkeleton({
  count = websiteConfig.blog.paginationSize,
  showHero = false,
}: { count?: number; showHero?: boolean }) {
  if (showHero && count > 0) {
    return (
      <div className="space-y-12">
        {/* Hero skeleton */}
        <div className="flex flex-col md:flex-row gap-6 border border-border rounded-lg overflow-hidden">
          <div className="md:w-2/5 aspect-[3/2]">
            <BlogCardSkeleton />
          </div>
          <div className="flex-1 p-6">
            <BlogCardSkeleton />
          </div>
        </div>

        {/* Grid skeletons */}
        {count > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {[...Array(count - 1)].map((_, index) => (
              <BlogCardSkeleton key={index} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      {[...Array(count)].map((_, index) => (
        <BlogCardSkeleton key={index} />
      ))}
    </div>
  );
}
