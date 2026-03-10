'use client';

import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

interface HeroSearchSectionProps {
  locale: string;
  translations: {
    badge: string;
    title: string;
    subtitle: string;
    searchPlaceholder: string;
  };
}

export function HeroSearchSection({
  locale,
  translations,
}: HeroSearchSectionProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(
        `/${locale}/tools?search=${encodeURIComponent(query.trim())}`
      );
    }
  };

  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      {/* 背景渐变 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0052ff]/5 via-transparent to-[#3d8bff]/5" />

      {/* 装饰性几何图形 */}
      <div className="absolute left-0 top-0 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0052ff]/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 size-96 translate-x-1/2 translate-y-1/2 rounded-full bg-[#3d8bff]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          {/* Badge */}
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 inline-block rounded-full bg-[#0052ff]/10 px-4 py-2 text-sm font-semibold text-[#0052ff] dark:bg-[#0052ff]/20"
          >
            {translations.badge}
          </motion.span>

          {/* 标题 */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6 text-4xl font-bold tracking-tight text-[#0f172a] dark:text-[#f8fafc] lg:text-6xl"
          >
            {translations.title}
          </motion.h1>

          {/* 副标题 */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-12 text-lg text-[#64748b] dark:text-[#94a3b8] lg:text-xl"
          >
            {translations.subtitle}
          </motion.p>

          {/* 搜索框 */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            onSubmit={handleSearch}
            className="mb-12"
          >
            <div className="relative mx-auto max-w-2xl">
              <Search className="absolute left-6 top-1/2 size-6 -translate-y-1/2 text-[#64748b] dark:text-[#94a3b8]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={translations.searchPlaceholder}
                className="w-full rounded-2xl border-2 border-[#e2e8f0] bg-white py-5 pl-16 pr-6 text-lg text-[#0f172a] shadow-lg transition-all placeholder:text-[#94a3b8] hover:border-[#cbd5e1] focus:border-[#0052ff] focus:outline-none focus:ring-4 focus:ring-[#0052ff]/10 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f8fafc] dark:placeholder:text-[#64748b] dark:hover:border-[#475569] dark:focus:border-[#3d8bff] dark:focus:ring-[#3d8bff]/10"
              />
            </div>
          </motion.form>
        </motion.div>
      </div>
    </section>
  );
}
