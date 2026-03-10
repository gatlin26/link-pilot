/**
 * @file tools-showcase-section-client.tsx
 * @description Client component for Tools Showcase Section
 * @author git.username
 * @date 2026-01-25
 */

'use client';

import { cn } from '@/lib/utils';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface Tool {
  id: string;
  name: string;
  description: string;
  image: string;
  href: string;
  category: string[];
  badge?: string;
}

interface ToolsShowcaseSectionClientProps {
  tools: Tool[];
  locale: string;
}

interface ToolCardProps {
  tool: Tool;
  index: number;
  locale: string;
}

function ToolCard({ tool, index, locale }: ToolCardProps) {
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
      <Link href={`/${locale}${tool.href}`}>
        <div
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1e293b] ring-1 ring-[#e2e8f0] dark:ring-[#334155] transition-all duration-300"
          style={{
            boxShadow:
              '0 10px 30px -10px rgba(0, 0, 0, 0.1), 0 4px 15px -5px rgba(0, 82, 255, 0.08)',
          }}
        >
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100/50 to-gray-50 dark:from-gray-900 dark:via-gray-800/50 dark:to-gray-900">
            {tool.image && (
              <Image
                src={tool.image}
                alt={tool.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />

            {tool.badge && (
              <div className="absolute top-3 right-3">
                <span className="px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-[#0052ff] to-[#3d8bff] text-white rounded-full shadow-lg">
                  {tool.badge}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-[#0f172a] dark:text-[#f8fafc] line-clamp-1">
              {tool.name}
            </h3>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8] line-clamp-2">
              {tool.description}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function ToolsShowcaseSectionClient({
  tools,
  locale,
}: ToolsShowcaseSectionClientProps) {
  const t = useTranslations('LandingPage.toolsShowcase');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // 获取所有唯一的分类
  const allCategories = Array.from(
    new Set(tools.flatMap((tool) => tool.category))
  );

  const categories = [
    { id: 'all', label: t('tabs.all') || 'All' },
    ...allCategories.map((cat) => ({
      id: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
    })),
  ];

  // 过滤工具
  const filteredTools =
    activeCategory === 'all'
      ? tools
      : tools.filter((tool) => tool.category.includes(activeCategory));

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />

      {/* Decorative blobs */}
      <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-gradient-to-br from-[#0052ff]/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-[#3d8bff]/5 to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-12 lg:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 rounded-full mb-5">
            <Sparkles className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
            <span className="text-sm text-[#0052ff] dark:text-[#3d8bff] font-semibold uppercase tracking-wider">
              {t('badge')}
            </span>
          </div>

          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight mb-5">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('title')}
            </span>
          </h2>

          <p className="text-[#64748b] dark:text-[#94a3b8] text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Tab Switcher */}
        {categories.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center mb-10"
          >
            <div className="inline-flex items-center p-1.5 bg-[#f1f5f9] dark:bg-[#1e293b] rounded-full ring-1 ring-[#e2e8f0] dark:ring-[#334155] overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    'relative px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap',
                    activeCategory === category.id
                      ? 'text-white'
                      : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                  )}
                >
                  {activeCategory === category.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-r from-[#0052ff] to-[#3d8bff] rounded-full"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative z-10">{category.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tools Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {filteredTools.map((tool, index) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                index={index}
                locale={locale}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* View More */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex justify-center mt-12"
        >
          <Link
            href={`/${locale}/tools`}
            className="inline-flex items-center gap-2 text-[#0052ff] dark:text-[#3d8bff] font-semibold hover:opacity-80 transition-opacity"
          >
            <span>{t('viewMore')}</span>
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
