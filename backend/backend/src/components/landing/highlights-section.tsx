/**
 * @file highlights-section.tsx
 * @description Highlights Section - Easemate style glassmorphism cards
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import { cn } from '@/lib/utils';
import { Cpu, Palette, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

const highlightIcons = [Zap, Cpu, Palette];

export function HighlightsSection() {
  const t = useTranslations('LandingPage.highlights');

  const highlights = [
    {
      title: t('items.easy.title'),
      description: t('items.easy.description'),
      icon: highlightIcons[0],
    },
    {
      title: t('items.models.title'),
      description: t('items.models.description'),
      icon: highlightIcons[1],
    },
    {
      title: t('items.free.title'),
      description: t('items.free.description'),
      icon: highlightIcons[2],
    },
  ];

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />

      {/* Mesh gradient blobs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-[#0052ff]/8 to-[#3d8bff]/4 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-[#3d8bff]/8 to-[#0052ff]/4 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-14 lg:mb-18"
        >
          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight mb-5">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('title')}
            </span>
          </h2>
          <p className="text-[#64748b] dark:text-[#94a3b8] text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Glassmorphism Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group cursor-pointer"
              >
                <div
                  className={cn(
                    'relative p-8 lg:p-10 rounded-3xl overflow-hidden',
                    'bg-white/70 dark:bg-[#111827]/70',
                    'backdrop-blur-xl',
                    'border border-[#e2e8f0]/80 dark:border-[#334155]/80',
                    'transition-all duration-300',
                    'hover:border-[#0052ff]/40 dark:hover:border-[#3d8bff]/40'
                  )}
                  style={{
                    boxShadow:
                      '0 8px 32px -8px rgba(0, 82, 255, 0.1), 0 4px 16px -4px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0052ff]/10 via-transparent to-[#3d8bff]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Icon */}
                  <div
                    className={cn(
                      'relative z-10 size-14 rounded-2xl mb-6',
                      'bg-gradient-to-br from-[#0052ff] to-[#3d8bff]',
                      'flex items-center justify-center',
                      'group-hover:scale-110 transition-transform duration-300'
                    )}
                    style={{
                      boxShadow: '0 8px 20px -4px rgba(0, 82, 255, 0.4)',
                    }}
                  >
                    <Icon className="size-7 text-white" strokeWidth={1.5} />
                  </div>

                  {/* Title */}
                  <h3 className="relative z-10 text-xl lg:text-2xl font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-3 group-hover:text-[#0052ff] dark:group-hover:text-[#3d8bff] transition-colors">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="relative z-10 text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                    {item.description}
                  </p>

                  {/* Decorative corner accent */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#0052ff]/10 to-transparent rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
