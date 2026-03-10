/**
 * @file pagination.tsx
 * @description Pagination component for tool list
 * @author git.username
 * @date 2026-01-25
 */

'use client';

import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  locale: string;
}

export function Pagination({
  currentPage,
  totalPages,
  baseUrl,
  locale,
}: PaginationProps) {
  const t = useTranslations('Common');

  if (totalPages <= 1) return null;

  const getPageUrl = (page: number) => {
    if (page === 1) {
      return `/${locale}${baseUrl}`;
    }
    return `/${locale}${baseUrl}/page/${page}`;
  };

  const renderPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <nav className="flex items-center justify-center gap-2 mt-12">
      {/* Previous Button */}
      {currentPage > 1 ? (
        <Link
          href={getPageUrl(currentPage - 1)}
          className={cn(
            'flex items-center gap-1 px-4 py-2 rounded-lg',
            'bg-white dark:bg-[#1e293b]',
            'border border-[#e2e8f0] dark:border-[#334155]',
            'text-[#64748b] dark:text-[#94a3b8]',
            'hover:bg-[#f8fafc] dark:hover:bg-[#334155]',
            'transition-colors duration-200'
          )}
        >
          <ChevronLeft className="size-4" />
          <span className="text-sm font-medium">Previous</span>
        </Link>
      ) : (
        <div
          className={cn(
            'flex items-center gap-1 px-4 py-2 rounded-lg',
            'bg-[#f8fafc] dark:bg-[#0f172a]',
            'border border-[#e2e8f0] dark:border-[#334155]',
            'text-[#cbd5e1] dark:text-[#475569]',
            'cursor-not-allowed'
          )}
        >
          <ChevronLeft className="size-4" />
          <span className="text-sm font-medium">Previous</span>
        </div>
      )}

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {renderPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-[#64748b] dark:text-[#94a3b8]"
              >
                ...
              </span>
            );
          }

          const pageNum = page as number;
          const isActive = pageNum === currentPage;

          return (
            <Link
              key={pageNum}
              href={getPageUrl(pageNum)}
              className={cn(
                'min-w-[40px] h-[40px] flex items-center justify-center rounded-lg',
                'text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-[#0052ff] to-[#3d8bff] text-white shadow-lg'
                  : 'bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#334155]'
              )}
            >
              {pageNum}
            </Link>
          );
        })}
      </div>

      {/* Next Button */}
      {currentPage < totalPages ? (
        <Link
          href={getPageUrl(currentPage + 1)}
          className={cn(
            'flex items-center gap-1 px-4 py-2 rounded-lg',
            'bg-white dark:bg-[#1e293b]',
            'border border-[#e2e8f0] dark:border-[#334155]',
            'text-[#64748b] dark:text-[#94a3b8]',
            'hover:bg-[#f8fafc] dark:hover:bg-[#334155]',
            'transition-colors duration-200'
          )}
        >
          <span className="text-sm font-medium">Next</span>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <div
          className={cn(
            'flex items-center gap-1 px-4 py-2 rounded-lg',
            'bg-[#f8fafc] dark:bg-[#0f172a]',
            'border border-[#e2e8f0] dark:border-[#334155]',
            'text-[#cbd5e1] dark:text-[#475569]',
            'cursor-not-allowed'
          )}
        >
          <span className="text-sm font-medium">Next</span>
          <ChevronRight className="size-4" />
        </div>
      )}
    </nav>
  );
}
