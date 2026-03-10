/**
 * @file features-section.tsx
 * @description Features Section - Vidlyo style with sticky scroll cards
 * @author git.username
 * @date 2026-01-17
 */

'use client';

import {
  StickyScrollSections,
  type StickySection,
} from '@/components/landing/sticky-scroll-sections';
import { cn } from '@/lib/utils';
import {
  Film,
  Image as ImageIcon,
  Images,
  Paintbrush,
  Palette,
  Shirt,
  Sparkles,
  Video,
  Wand2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

// ============================================================================
// Types
// ============================================================================

interface FeatureData {
  key: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  image: string | string[]; // 支持单张或多张图片
  imagePosition?: 'left' | 'right'; // 多张图片时不需要
  background: string;
}

// ============================================================================
// Feature Card Content Component
// ============================================================================

interface FeatureCardContentProps {
  subtitle: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  image: string;
  cta: string;
}

function FeatureCardContent({
  subtitle,
  title,
  description,
  icon: Icon,
  image,
  cta,
}: FeatureCardContentProps) {
  const handleCtaClick = () => {
    const element = document.getElementById('ai-editor');
    element?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <>
      {/* 图片区域 - 自适应比例，支持横向和竖向图片 */}
      <div className="flex justify-center items-center max-w-full lg:max-w-[55%] rounded-2xl overflow-hidden">
        <img
          src={image}
          alt={title}
          loading="eager"
          className="rounded-2xl w-auto h-auto max-w-full max-h-[500px] lg:max-h-[450px] object-contain"
        />
      </div>

      {/* 文字区域 */}
      <section className="w-fit max-w-full lg:max-w-[460px]">
        {/* Icon + Subtitle */}
        <div className="flex items-center gap-3 mb-4">
          <div className="size-11 rounded-xl bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 flex items-center justify-center">
            <Icon
              className="size-5 text-[#0052ff] dark:text-[#3d8bff]"
              strokeWidth={1.5}
            />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-[#0052ff] dark:text-[#3d8bff]">
            {subtitle}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg lg:text-[32px] leading-6 lg:leading-10 text-[#0f172a] dark:text-white font-bold">
          {title}
        </h3>

        {/* Description */}
        <div className="text-sm lg:text-base text-[#64748b] dark:text-gray-300 text-wrap font-normal text-left my-5 lg:my-10">
          {description}
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={handleCtaClick}
          className={cn(
            'inline-flex justify-center items-center',
            'bg-gradient-to-r from-[#0052ff] to-[#3d8bff]',
            'hover:from-[#0047e6] hover:to-[#3580f0]',
            'px-11 h-9 lg:h-12 rounded-full',
            'transition-colors duration-300'
          )}
        >
          <span className="text-sm lg:text-base text-white font-bold">
            {cta}
          </span>
        </button>
      </section>
    </>
  );
}

// ============================================================================
// Features Data
// ============================================================================

const FEATURES_DATA: FeatureData[] = [
  // ============================================================================
  // 图片创作功能（优先展示）
  // ============================================================================
  {
    key: 'textToImage',
    icon: Sparkles,
    image:
      'https://s.vidlyo.net/production/37af7a92-84a4-4189-b754-0e7fb1f9d5a3.png',
    imagePosition: 'right',
    background:
      'bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#f0f9ff] dark:from-[#0c1929] dark:via-[#0f172a] dark:to-[#0c1929]',
  },
  {
    key: 'ghibliStyle',
    icon: Sparkles,
    image: [
      '/images/features/ghibli-style-before.jpg',
      '/images/features/ghibli-style-after.png',
    ],
    background:
      'bg-gradient-to-br from-[#f0fdf4] via-[#dcfce7] to-[#f0fdf4] dark:from-[#042f2e] dark:via-[#14532d] dark:to-[#042f2e]',
  },
  {
    key: 'handMadePaintings',
    icon: Paintbrush,
    image: [
      '/images/features/hand-made-paintings-before.png',
      '/images/features/hand-made-paintings-after.png',
    ],
    background:
      'bg-gradient-to-br from-[#fffbeb] via-[#fef3c7] to-[#fffbeb] dark:from-[#1c1917] dark:via-[#292524] dark:to-[#1c1917]',
  },
  {
    key: 'aiOutfitChange',
    icon: Shirt,
    image: [
      '/images/features/multi-image-before.png',
      '/images/features/multi-image-after.png',
    ],
    background:
      'bg-gradient-to-br from-[#fff5f7] via-[#ffeef2] to-[#fff5f7] dark:from-[#2d1b1f] dark:via-[#3d2a2f] dark:to-[#2d1b1f]',
  },
  // ============================================================================
  // 视频功能（未来推出 - 可以标记为"即将推出"）
  // ============================================================================
  {
    key: 'aiAnimation',
    icon: Wand2,
    image: '/images/features/ai-animation-ghibli.png',
    imagePosition: 'left',
    background:
      'bg-gradient-to-br from-[#fef2f2] via-[#fecaca] to-[#fef2f2] dark:from-[#1f0a0a] dark:via-[#450a0a] dark:to-[#1f0a0a]',
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function FeaturesSection() {
  const t = useTranslations('LandingPage.features');

  // 构建 sticky scroll sections
  const sections: StickySection[] = FEATURES_DATA.map((feature) => {
    const isMultipleImages = Array.isArray(feature.image);

    // 如果是多张图片，使用新的 images 属性
    if (isMultipleImages) {
      const images = feature.image as string[]; // TypeScript 类型收窄
      return {
        id: feature.key,
        background: feature.background,
        images: images,
        imageAlt: images.map(
          (_, index) =>
            t(
              `items.${feature.key}.imageAlt.${index}` as Parameters<
                typeof t
              >[0]
            ) || `Image ${index + 1}`
        ),
        textContent: {
          subtitle: t(
            `items.${feature.key}.subtitle` as Parameters<typeof t>[0]
          ),
          icon: feature.icon,
          title: t(`items.${feature.key}.title` as Parameters<typeof t>[0]),
          highlightedTitle: t(
            `items.${feature.key}.highlightedTitle` as Parameters<typeof t>[0]
          ),
          description: t(
            `items.${feature.key}.description` as Parameters<typeof t>[0]
          ),
          buttonText: t('cta'),
          buttonHref: '#ai-editor',
        },
      };
    }

    // 单张图片，使用原有的 content 方式
    return {
      id: feature.key,
      imagePosition: feature.imagePosition,
      background: feature.background,
      content: (
        <FeatureCardContent
          subtitle={t(
            `items.${feature.key}.subtitle` as Parameters<typeof t>[0]
          )}
          title={t(`items.${feature.key}.title` as Parameters<typeof t>[0])}
          description={t(
            `items.${feature.key}.description` as Parameters<typeof t>[0]
          )}
          icon={feature.icon}
          image={feature.image as string}
          cta={t('cta')}
        />
      ),
    };
  });

  return (
    <section className="relative">
      {/* Section Header */}
      <div className="relative z-10 pt-20 lg:pt-28 pb-8 lg:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 rounded-full mb-5">
              <Sparkles className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
              <span className="text-sm text-[#0052ff] dark:text-[#3d8bff] font-semibold uppercase tracking-wider">
                {t('sectionLabel')}
              </span>
            </div>

            <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight mb-5">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
                {t('title')}
              </span>
            </h2>
            <p className="text-[#64748b] dark:text-[#94a3b8] text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed">
              {t('subtitle')}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Sticky Scroll Features */}
      <StickyScrollSections sections={sections} headerHeight={64} />
    </section>
  );
}
