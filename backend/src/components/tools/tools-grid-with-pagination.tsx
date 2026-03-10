/**
 * @file tools-grid-with-pagination.tsx
 * @description Tools grid with pagination component
 * @author git.username
 * @date 2026-01-25
 */

'use client';

import { Pagination } from '@/components/shared/pagination';
import type { SerializableTool } from '@/lib/source';
import { AnimatePresence, motion } from 'motion/react';
import { ToolCard } from './tool-card';

interface ToolsGridWithPaginationProps {
  tools: SerializableTool[];
  currentPage: number;
  totalPages: number;
  locale: string;
}

export function ToolsGridWithPagination({
  tools,
  currentPage,
  totalPages,
  locale,
}: ToolsGridWithPaginationProps) {
  return (
    <div>
      {/* Tools Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {tools.map((tool, index) => (
            <ToolCard
              key={tool.data.id}
              tool={tool}
              index={index}
              locale={locale}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        baseUrl="/tools"
        locale={locale}
      />
    </div>
  );
}
