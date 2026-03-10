/**
 * @file intro-sections.tsx
 * @description Intro Section - Easemate style Bento Grid layout
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import { cn } from '@/lib/utils';
import { HelpCircle, Lightbulb, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

interface IntroItem {
  subtitleKey: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  gridSpan: string;
}

export function IntroSections() {
  const t = useTranslations('LandingPage.intro');

  const introItems: IntroItem[] = [
    {
      subtitleKey: 'what.subtitle',
      titleKey: 'what.title',
      descriptionKey: 'what.description',
      icon: HelpCircle,
      gridSpan: 'md:col-span-2',
    },
    {
      subtitleKey: 'why.subtitle',
      titleKey: 'why.title',
      descriptionKey: 'why.description',
      icon: Lightbulb,
      gridSpan: 'md:col-span-1',
    },
    {
      subtitleKey: 'struggling.subtitle',
      titleKey: 'struggling.title',
      descriptionKey: 'struggling.description',
      icon: Sparkles,
      gridSpan: 'md:col-span-3',
    },
  ];

  return (
    <section className="relative py-24 lg:py-32 bg-white dark:bg-[#0a0f1a]">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f8fafc] via-white to-white dark:from-[#0f172a] dark:via-[#0a0f1a] dark:to-[#0a0f1a]" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#0052ff]/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#3d8bff]/5 to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16 lg:mb-20"
        >
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 rounded-full mb-5">
            <span className="text-sm text-[#0052ff] dark:text-[#3d8bff] font-semibold uppercase tracking-wider">
              {t('sectionLabel')}
            </span>
          </div>

          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('sectionTitle')}
            </span>
          </h2>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {introItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={cn('group', item.gridSpan)}
            >
              <div
                className={cn(
                  'relative h-full p-8 lg:p-10 rounded-3xl',
                  'bg-white dark:bg-[#111827]',
                  'border border-[#e2e8f0] dark:border-[#334155]',
                  'transition-all duration-300',
                  'hover:border-[#0052ff]/30 dark:hover:border-[#3d8bff]/30',
                  'group-hover:-translate-y-1'
                )}
                style={{
                  boxShadow:
                    '0 4px 20px -5px rgba(0, 0, 0, 0.06), 0 2px 10px -3px rgba(0, 82, 255, 0.05)',
                }}
              >
                {/* Gradient background on hover */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#0052ff]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div
                    className={cn(
                      'size-14 rounded-2xl mb-6',
                      'bg-gradient-to-br from-[#0052ff]/10 to-[#3d8bff]/5',
                      'border border-[#0052ff]/10',
                      'flex items-center justify-center',
                      'group-hover:scale-110 transition-transform duration-300'
                    )}
                  >
                    <item.icon
                      className="size-7 text-[#0052ff] dark:text-[#3d8bff]"
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Subtitle */}
                  <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#0052ff] dark:text-[#3d8bff] mb-4">
                    {t(item.subtitleKey as Parameters<typeof t>[0])}
                  </span>

                  {/* Title */}
                  <h3 className="font-heading text-xl lg:text-2xl font-semibold text-[#0f172a] dark:text-[#f8fafc] leading-snug mb-4">
                    {t(item.titleKey as Parameters<typeof t>[0])}
                  </h3>

                  {/* Description */}
                  <p className="text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                    {t(item.descriptionKey as Parameters<typeof t>[0])}
                  </p>
                </div>

                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-10 right-10 h-0.5 rounded-full bg-gradient-to-r from-[#0052ff]/30 via-[#3d8bff]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
