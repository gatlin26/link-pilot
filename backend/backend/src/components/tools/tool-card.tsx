/**
 * @file tool-card.tsx
 * @description Tool card component for displaying AI tools
 * @author git.username
 * @date 2026-01-25
 */

'use client';

import type { SerializableTool } from '@/lib/source';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';

interface ToolCardProps {
  tool: SerializableTool;
  index?: number;
  locale: string;
}

export function ToolCard({ tool, index = 0, locale }: ToolCardProps) {
  const { data } = tool;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="cursor-pointer"
    >
      <Link href={`/${locale}${data.href}`}>
        <div
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1e293b] ring-1 ring-[#e2e8f0] dark:ring-[#334155] transition-all duration-300"
          style={{
            boxShadow:
              '0 10px 30px -10px rgba(0, 0, 0, 0.1), 0 4px 15px -5px rgba(0, 82, 255, 0.08)',
          }}
        >
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100/50 to-gray-50 dark:from-gray-900 dark:via-gray-800/50 dark:to-gray-900">
            {data.thumbnailUrl && (
              <Image
                src={data.thumbnailUrl}
                alt={data.name}
                fill
                className="object-cover"
                quality={75}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            )}
            {/* Subtle overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />

            {/* Badge */}
            {data.badge && (
              <div className="absolute top-3 right-3">
                <span className="px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-[#0052ff] to-[#3d8bff] text-white rounded-full shadow-lg">
                  {data.badge}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-[#0f172a] dark:text-[#f8fafc] line-clamp-1">
              {data.name}
            </h3>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8] line-clamp-2">
              {data.description}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
