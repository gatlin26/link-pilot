/**
 * @file faq-section.tsx
 * @description FAQ Section - Easemate style modern accordion
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import { FAQAccordion } from '@/components/landing/ui/faq-accordion';
import { HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

export function FaqSection() {
  const t = useTranslations('LandingPage.faq');

  const faqs = [
    {
      question: t('items.noSignup.question'),
      answer: t('items.noSignup.answer'),
    },
    {
      question: t('items.freeToUse.question'),
      answer: t('items.freeToUse.answer'),
    },
    {
      question: t('items.upscale.question'),
      answer: t('items.upscale.answer'),
    },
    {
      question: t('items.enhance.question'),
      answer: t('items.enhance.answer'),
    },
    {
      question: t('items.pixelated.question'),
      answer: t('items.pixelated.answer'),
    },
    {
      question: t('items.secured.question'),
      answer: t('items.secured.answer'),
    },
    {
      question: t('items.mobileSupport.question'),
      answer: t('items.mobileSupport.answer'),
    },
    {
      question: t('items.regenerate.question'),
      answer: t('items.regenerate.answer'),
    },
    {
      question: t('items.commercial.question'),
      answer: t('items.commercial.answer'),
    },
  ];

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />

      {/* Mesh gradient blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-[#0052ff]/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-tl from-[#3d8bff]/5 to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-14 lg:mb-16"
        >
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 rounded-full mb-5">
            <HelpCircle className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
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
            {t('description')}
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {/* Glassmorphism card wrapper */}
          <div
            className="relative bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-3xl border border-[#e2e8f0] dark:border-[#334155] p-6 lg:p-8"
            style={{
              boxShadow:
                '0 10px 40px -10px rgba(0, 82, 255, 0.1), 0 4px 20px -5px rgba(0, 0, 0, 0.06)',
            }}
          >
            <FAQAccordion items={faqs} />
          </div>
        </motion.div>

        {/* Bottom hint */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center text-[#94a3b8] dark:text-[#64748b] text-sm mt-8"
        >
          {t('moreHelp')}{' '}
          <a
            href="mailto:support@buildway.cc"
            className="text-[#0052ff] dark:text-[#3d8bff] font-medium hover:underline"
          >
            {t('contactUs')}
          </a>
        </motion.p>
      </div>
    </section>
  );
}
