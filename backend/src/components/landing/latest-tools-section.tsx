'use client';

import { Button } from '@/components/ui/button';
import type { SerializableTool } from '@/lib/source';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface LatestToolsSectionProps {
  tools: SerializableTool[];
  featuredTools?: SerializableTool[];
  locale: string;
  translations: {
    justLaunched: string;
    viewAll: string;
    featuredTitle?: string;
  };
}

const FEATURED_MAX = 48; // 4 列 × 12 行

export function LatestToolsSection({
  tools,
  featuredTools = [],
  locale,
  translations,
}: LatestToolsSectionProps) {
  // 按 collectionTime 排序，取最新的 12 个
  const latestTools = tools
    .sort(
      (a, b) =>
        new Date(b.data.collectionTime).getTime() -
        new Date(a.data.collectionTime).getTime()
    )
    .slice(0, 12);

  const hasFeatured = featuredTools.length > 0;
  const displayFeatured = featuredTools.slice(0, FEATURED_MAX);

  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 上下布局：最新工具在上，精选在下 */}
        <div className="mb-12 flex flex-col gap-16">
          {/* 上方：最新工具 */}
          <div>
            <h2 className="mb-6 text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] lg:text-3xl">
              {translations.justLaunched}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {latestTools.map((tool, index) => (
                <motion.div
                  key={tool.data.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                  <Link
                    href={`/${locale}${tool.data.href}`}
                    className="group block h-full cursor-pointer"
                  >
                    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm transition-all hover:border-[#cbd5e1] hover:shadow-md dark:border-[#334155] dark:bg-[#1e293b] dark:hover:border-[#475569]">
                      {/* 工具图片 */}
                      <div className="relative aspect-video overflow-hidden bg-[#f8fafc] dark:bg-[#0f172a]">
                        {tool.data.image?.trim() ? (
                          <img
                            src={tool.data.image}
                            alt={tool.data.name}
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center text-[#94a3b8]">
                            无图片
                          </div>
                        )}
                      </div>

                      {/* 工具信息 */}
                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="mb-2 text-lg font-semibold text-[#0f172a] transition-colors group-hover:text-[#0052ff] dark:text-[#f8fafc] dark:group-hover:text-[#3d8bff]">
                          {tool.data.name}
                        </h3>
                        <p className="line-clamp-2 flex-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
                          {tool.data.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
            {/* 查看全部按钮（仅最新工具下方） */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mt-10 text-center"
            >
              <Button asChild size="lg" className="group cursor-pointer">
                <Link href={`/${locale}/tools`}>
                  {translations.viewAll}
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* 下方：精选（仅当有精选时渲染，无查看更多按钮） */}
          {hasFeatured && translations.featuredTitle && (
            <div>
              <h2 className="mb-6 text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] lg:text-3xl">
                {translations.featuredTitle}
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {displayFeatured.map((tool, index) => (
                  <motion.div
                    key={tool.data.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <Link
                      href={`/${locale}${tool.data.href}`}
                      className="group block h-full cursor-pointer"
                    >
                      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm transition-all hover:border-[#cbd5e1] hover:shadow-md dark:border-[#334155] dark:bg-[#1e293b] dark:hover:border-[#475569]">
                        <div className="relative aspect-video overflow-hidden bg-[#f8fafc] dark:bg-[#0f172a]">
                          {tool.data.image?.trim() ||
                          tool.data.thumbnailUrl?.trim() ? (
                            <img
                              src={
                                tool.data.image?.trim() ||
                                tool.data.thumbnailUrl ||
                                ''
                              }
                              alt={tool.data.name}
                              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="size-full flex items-center justify-center text-[#94a3b8]">
                              无图片
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <h3 className="mb-2 text-lg font-semibold text-[#0f172a] transition-colors group-hover:text-[#0052ff] dark:text-[#f8fafc] dark:group-hover:text-[#3d8bff]">
                            {tool.data.name}
                          </h3>
                          <p className="line-clamp-2 flex-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {tool.data.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
