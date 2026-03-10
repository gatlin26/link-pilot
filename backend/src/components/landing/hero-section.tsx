/**
 * @file hero-section.tsx
 * @description Landing 页面 Hero 区域
 * @author git.username
 * @date 2025-12-22
 */

'use client';

import { BeforeAfterSlider } from '@/components/landing/ui/before-after-slider';
import {
  ArrowRight,
  ChevronDown,
  MousePointer2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

export function HeroSection() {
  const t = useTranslations('LandingPage.hero');

  return (
    <section className="relative min-h-screen flex items-center">
      {/* 渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />

      {/* 装饰性几何图形 */}
      <div className="absolute top-20 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-0 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* 左侧文案 */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            {/* 标签 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium tracking-wide">
                {t('badge')}
              </span>
            </motion.div>

            {/* 主标题 */}
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[1.1]">
              <span className="block">{t('title')}</span>
              <span className="block text-primary">{t('titleHighlight')}</span>
            </h1>

            {/* 副标题 */}
            <p className="text-xl lg:text-2xl text-muted-foreground font-light leading-relaxed max-w-lg">
              {t('subtitle')}{' '}
              <span className="text-foreground">{t('noPlasticSkin')}</span>{' '}
              <span className="text-foreground">{t('noBeautyFilter')}</span>
            </p>

            {/* 描述 */}
            <p className="text-muted-foreground leading-relaxed max-w-md">
              {t('description')}
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const element = document.getElementById('quick-enhance');
                  element?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className="group flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span>{t('cta')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <button className="flex items-center justify-center gap-2 px-8 py-4 border border-border text-muted-foreground font-medium rounded-lg hover:border-primary/50 hover:text-foreground transition-colors">
                <MousePointer2 className="w-4 h-4" />
                <span>{t('ctaSecondary')}</span>
              </button>
            </div>
          </motion.div>

          {/* 右侧图片 */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative"
          >
            {/* 装饰边框 */}
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl blur-xl" />

            {/* 主图片容器 */}
            <div className="relative">
              <BeforeAfterSlider
                beforeImage="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&q=80"
                afterImage="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&q=80&sat=-20&brightness=1.15&contrast=1.1"
                defaultPosition={65}
                className="aspect-[4/5] rounded-2xl border border-border"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* 滚动提示 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
          className="flex flex-col items-center gap-2 text-muted-foreground"
        >
          <span className="text-xs uppercase tracking-widest">
            {t('scroll')}
          </span>
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </motion.div>
    </section>
  );
}
