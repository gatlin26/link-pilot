'use client';

import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';

interface SubmitToolCtaProps {
  locale: string;
  translations: {
    badge: string;
    title: string;
    description: string;
    button: string;
  };
}

export function SubmitToolCta({ locale, translations }: SubmitToolCtaProps) {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0052ff]/10 to-[#3d8bff]/10 p-12 backdrop-blur-xl"
        >
          {/* 装饰性背景 */}
          <div className="absolute left-0 top-0 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0052ff]/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 size-64 translate-x-1/2 translate-y-1/2 rounded-full bg-[#3d8bff]/20 blur-3xl" />

          <div className="relative text-center">
            {/* Badge */}
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#0052ff]/20 px-4 py-2 text-sm font-semibold text-[#0052ff] dark:bg-[#0052ff]/30"
            >
              <Sparkles className="size-4" />
              {translations.badge}
            </motion.span>

            {/* 标题 */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4 text-3xl font-bold text-[#0f172a] dark:text-[#f8fafc] lg:text-4xl"
            >
              {translations.title}
            </motion.h2>

            {/* 描述 */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-8 text-lg text-[#64748b] dark:text-[#94a3b8]"
            >
              {translations.description}
            </motion.p>

            {/* CTA 按钮 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Button asChild size="lg" className="group cursor-pointer">
                <Link href={`/${locale}/tools/submit`}>
                  {translations.button}
                  <Sparkles className="ml-2 size-4 transition-transform group-hover:rotate-12" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
