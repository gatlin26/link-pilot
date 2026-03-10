/**
 * @file trust-security-section.tsx
 * @description Trust & Security Section - Easemate style modern Trust Badges
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, Layers, Shield, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

export function TrustSecuritySection() {
  const t = useTranslations('LandingPage.trustSecurity');

  const features = [
    {
      title: t('features.encryption.title'),
      description: t('features.encryption.description'),
      icon: Shield,
    },
    {
      title: t('features.private.title'),
      description: t('features.private.description'),
      icon: Layers,
    },
    {
      title: t('features.secure.title'),
      description: t('features.secure.description'),
      icon: Zap,
    },
    {
      title: t('features.noSharing.title'),
      description: t('features.noSharing.description'),
      icon: CheckCircle2,
    },
  ];

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f8fafc] via-white to-[#f8fafc] dark:from-[#0f172a] dark:via-[#0a0f1a] dark:to-[#0f172a]" />

      {/* Mesh gradient blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#0052ff]/8 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#3d8bff]/8 to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 rounded-full">
              <Shield className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
              <span className="text-sm text-[#0052ff] dark:text-[#3d8bff] font-semibold uppercase tracking-wider">
                {t('sectionLabel')}
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
            <p className="text-lg text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
              {t('description')}
            </p>
            <p className="text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
              {t('subDescription')}
            </p>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-4 pt-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#334155] rounded-full">
                <div className="size-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                  SSL Secured
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#334155] rounded-full">
                <div className="size-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                  GDPR Compliant
                </span>
              </div>
            </div>
          </motion.div>

          {/* Right - Trust Badges Grid */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="grid sm:grid-cols-2 gap-5"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: index * 0.1,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group"
              >
                <div
                  className={cn(
                    'relative p-6 rounded-2xl overflow-hidden',
                    'bg-white/80 dark:bg-[#111827]/80',
                    'backdrop-blur-xl',
                    'border border-[#e2e8f0] dark:border-[#334155]',
                    'transition-all duration-300',
                    'hover:border-[#0052ff]/30 dark:hover:border-[#3d8bff]/30'
                  )}
                  style={{
                    boxShadow:
                      '0 8px 32px -8px rgba(0, 82, 255, 0.08), 0 4px 16px -4px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0052ff]/5 via-transparent to-[#3d8bff]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Icon */}
                  <div
                    className={cn(
                      'relative z-10 size-12 rounded-xl mb-4',
                      'bg-gradient-to-br from-[#0052ff]/10 to-[#3d8bff]/5',
                      'border border-[#0052ff]/10',
                      'flex items-center justify-center',
                      'group-hover:scale-110 transition-transform duration-300'
                    )}
                  >
                    <feature.icon
                      className="size-6 text-[#0052ff] dark:text-[#3d8bff]"
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Title */}
                  <h3 className="relative z-10 font-heading text-lg font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-2 group-hover:text-[#0052ff] dark:group-hover:text-[#3d8bff] transition-colors">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="relative z-10 text-sm text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Corner accent */}
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#0052ff]/10 to-transparent rounded-bl-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
