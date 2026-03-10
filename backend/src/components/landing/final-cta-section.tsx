/**
 * @file final-cta-section.tsx
 * @description Final CTA Section - Easemate style with trust indicators
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import { ArrowRight, CheckCircle2, Shield, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

export function FinalCtaSection() {
  const t = useTranslations('LandingPage.finalCta');

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden border-t border-[#e2e8f0] dark:border-[#334155]">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f8fafc] via-white to-[#f8fafc] dark:from-[#0f172a] dark:via-[#0a0f1a] dark:to-[#0f172a]" />

      {/* Mesh gradient blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-br from-[#0052ff]/8 via-[#3d8bff]/4 to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-8"
        >
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 rounded-full mb-2">
            <Sparkles className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
            <span className="text-sm text-[#0052ff] dark:text-[#3d8bff] font-semibold uppercase tracking-wider">
              Get Started
            </span>
          </div>

          {/* Title */}
          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('title')}{' '}
            </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0052ff] to-[#3d8bff]">
              {t('titleHighlight')}
            </span>
          </h2>

          {/* Description */}
          <p className="text-lg lg:text-xl text-[#64748b] dark:text-[#94a3b8] max-w-2xl mx-auto leading-relaxed">
            {t('description')}
          </p>

          {/* CTA Button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const element = document.getElementById('ai-editor');
              element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#0052ff] to-[#3d8bff] text-white font-semibold text-lg rounded-xl hover:shadow-xl hover:shadow-[#0052ff]/30 transition-all duration-300"
            style={{
              boxShadow: '0 10px 30px -5px rgba(0, 82, 255, 0.4)',
            }}
          >
            <span>{t('cta')}</span>
            <ArrowRight className="size-5" strokeWidth={2} />
          </motion.button>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-6 pt-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#334155] rounded-full"
            >
              <CheckCircle2 className="size-4 text-green-500" strokeWidth={2} />
              <span className="text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">
                {t('trust.gdpr')}
              </span>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#334155] rounded-full"
            >
              <Shield
                className="size-4 text-[#0052ff] dark:text-[#3d8bff]"
                strokeWidth={2}
              />
              <span className="text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">
                {t('trust.noStorage')}
              </span>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#334155] rounded-full"
            >
              <CheckCircle2 className="size-4 text-green-500" strokeWidth={2} />
              <span className="text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">
                {t('trust.ssl')}
              </span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
