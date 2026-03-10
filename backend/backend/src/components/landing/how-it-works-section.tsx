/**
 * @file how-it-works-section.tsx
 * @description How It Works Section - Easemate style modern timeline
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import { cn } from '@/lib/utils';
import { Download, Settings2, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

const stepIcons = [Upload, Settings2, Download];

export function HowItWorksSection() {
  const t = useTranslations('LandingPage.howItWorks');

  const steps = [
    {
      step: t('steps.upload.step'),
      icon: stepIcons[0],
      title: t('steps.upload.title'),
      description: t('steps.upload.description'),
    },
    {
      step: t('steps.choose.step'),
      icon: stepIcons[1],
      title: t('steps.choose.title'),
      description: t('steps.choose.description'),
    },
    {
      step: t('steps.download.step'),
      icon: stepIcons[2],
      title: t('steps.download.title'),
      description: t('steps.download.description'),
    },
  ];

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden bg-white dark:bg-[#0a0f1a]">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />
      <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-gradient-to-br from-[#0052ff]/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-[#3d8bff]/5 to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
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

          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight mb-5">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('title')}
            </span>
          </h2>
          <p className="text-[#64748b] dark:text-[#94a3b8] text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Timeline - Desktop: Horizontal, Mobile: Vertical */}
        <div className="relative">
          {/* Connection line - Desktop */}
          <div className="hidden lg:block absolute top-[72px] left-0 right-0 h-0.5 bg-gradient-to-r from-[#e2e8f0] via-[#0052ff]/30 to-[#e2e8f0] dark:from-[#334155] dark:via-[#3d8bff]/30 dark:to-[#334155]" />

          {/* Steps Grid */}
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.15,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative"
                >
                  {/* Vertical connection line - Mobile */}
                  {index < steps.length - 1 && (
                    <div className="lg:hidden absolute left-[31px] top-[64px] bottom-[-32px] w-0.5 bg-gradient-to-b from-[#0052ff]/30 via-[#0052ff]/20 to-transparent dark:from-[#3d8bff]/30 dark:via-[#3d8bff]/20" />
                  )}

                  <div className="relative flex flex-col items-center text-center">
                    {/* Step number badge */}
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 25,
                      }}
                      className="relative z-10 mb-6"
                    >
                      <div
                        className={cn(
                          'size-16 rounded-2xl',
                          'bg-gradient-to-br from-[#0052ff] to-[#3d8bff]',
                          'flex items-center justify-center',
                          'transition-all duration-300'
                        )}
                        style={{
                          boxShadow:
                            '0 10px 25px -5px rgba(0, 82, 255, 0.4), 0 4px 12px -3px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <Icon className="size-8 text-white" strokeWidth={1.5} />
                      </div>
                      {/* Step number overlay */}
                      <div className="absolute -top-2 -right-2 size-7 rounded-full bg-white dark:bg-[#111827] border-2 border-[#0052ff] dark:border-[#3d8bff] flex items-center justify-center">
                        <span className="text-xs font-bold text-[#0052ff] dark:text-[#3d8bff]">
                          {index + 1}
                        </span>
                      </div>
                    </motion.div>

                    {/* Content card */}
                    <motion.div
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="w-full"
                    >
                      <div
                        className={cn(
                          'relative p-6 lg:p-8 rounded-2xl',
                          'bg-white dark:bg-[#111827]',
                          'border border-[#e2e8f0] dark:border-[#334155]',
                          'transition-all duration-300',
                          'hover:border-[#0052ff]/30 dark:hover:border-[#3d8bff]/30'
                        )}
                        style={{
                          boxShadow:
                            '0 4px 20px -5px rgba(0, 0, 0, 0.06), 0 2px 10px -3px rgba(0, 82, 255, 0.05)',
                        }}
                      >
                        {/* Step label */}
                        <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#0052ff] dark:text-[#3d8bff] mb-3">
                          {item.step}
                        </span>

                        {/* Title */}
                        <h3 className="font-heading text-xl lg:text-2xl font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-3 leading-snug">
                          {item.title}
                        </h3>

                        {/* Description */}
                        <p className="text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                          {item.description}
                        </p>

                        {/* Bottom accent line */}
                        <div className="absolute bottom-0 left-8 right-8 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#0052ff]/30 to-transparent" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
