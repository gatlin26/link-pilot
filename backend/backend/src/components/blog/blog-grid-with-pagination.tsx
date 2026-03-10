import type { SerializableBlogPost } from '@/lib/source';
import EmptyGrid from '../shared/empty-grid';
import { Pagination as CustomPagination } from '../shared/pagination';
import BlogGrid from './blog-grid';

interface BlogGridWithPaginationProps {
  locale: string;
  posts: SerializableBlogPost[];
  totalPages: number;
  routePrefix: string;
  currentPage?: number;
  readTimeLabel?: string;
  readTimeShortLabel?: string;
}

export default function BlogGridWithPagination({
  locale,
  posts,
  totalPages,
  routePrefix,
  currentPage = 1,
  readTimeLabel,
  readTimeShortLabel,
}: BlogGridWithPaginationProps) {
  // Show hero layout only on first page
  const showHero = currentPage === 1;

  return (
    <div>
      {posts.length === 0 && <EmptyGrid />}
      {posts.length > 0 && (
        <div>
          <BlogGrid
            locale={locale}
            posts={posts}
            showHero={showHero}
            readTimeLabel={readTimeLabel}
            readTimeShortLabel={readTimeShortLabel}
          />
          <div className="mt-12 flex items-center justify-center">
            <CustomPagination
              baseUrl={routePrefix}
              currentPage={currentPage}
              totalPages={totalPages}
              locale={locale}
            />
          </div>
        </div>
      )}
    </div>
  );
}
