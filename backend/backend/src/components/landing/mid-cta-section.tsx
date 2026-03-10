/**
 * @file mid-cta-section.tsx
 * @description Mid CTA Section - Easemate style with mesh gradient
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

export function MidCtaSection() {
  const t = useTranslations('LandingPage.midCta');

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />

      {/* Mesh gradient blobs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#0052ff]/10 via-[#3d8bff]/5 to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Glassmorphism card wrapper */}
          <div
            className="relative overflow-hidden rounded-3xl bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-[#e2e8f0] dark:border-[#334155] p-12 lg:p-16 text-center"
            style={{
              boxShadow:
                '0 20px 60px -15px rgba(0, 82, 255, 0.15), 0 8px 30px -8px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0052ff]/5 via-transparent to-[#3d8bff]/5" />

            {/* Decorative circles */}
            <div className="absolute -top-20 -left-20 size-40 bg-gradient-to-br from-[#0052ff]/20 to-transparent rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -right-20 size-40 bg-gradient-to-tl from-[#3d8bff]/20 to-transparent rounded-full blur-3xl" />

            {/* Content */}
            <div className="relative z-10 space-y-8">
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
                  element?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#0052ff] to-[#3d8bff] text-white font-semibold text-lg rounded-xl hover:shadow-xl hover:shadow-[#0052ff]/30 transition-all duration-300"
                style={{
                  boxShadow: '0 10px 30px -5px rgba(0, 82, 255, 0.4)',
                }}
              >
                <Sparkles className="size-5" strokeWidth={2} />
                <span>{t('cta')}</span>
                <ArrowRight className="size-5" strokeWidth={2} />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
