/**
 * @file gallery-section.tsx
 * @description Gallery Section - Easemate style infinite scroll with depth shadows
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

interface GalleryItem {
  id: string;
  imageUrl: string;
}

const GALLERY_ITEMS: GalleryItem[] = [
  { id: '1', imageUrl: '/images/gallery/girl-new-outfit.png' },
  { id: '2', imageUrl: '/images/gallery/ben-10-fashion-photoshoot.png' },
  { id: '3', imageUrl: '/images/gallery/pink-panther-fashion-photoshoot.png' },
  { id: '4', imageUrl: '/images/gallery/pikachu-fashion-photoshoot.png' },
  { id: '5', imageUrl: '/images/gallery/tom-jerry-fashion-photoshoot.png' },
  { id: '6', imageUrl: '/images/gallery/gift-box-editorial.png' },
  { id: '7', imageUrl: '/images/gallery/gift-box-editorial-sensual.png' },
  { id: '8', imageUrl: '/images/gallery/ghibli-meadow-fewer-spirits.png' },
  { id: '9', imageUrl: '/images/gallery/ghibli-meadow-wind-effects.png' },
  { id: '10', imageUrl: '/images/gallery/deconstructed-cheeseburger.png' },
  { id: '11', imageUrl: '/images/gallery/tonkotsu-ramen-infographic.png' },
  { id: '12', imageUrl: '/images/gallery/nezuko-kamado-cosplay.png' },
  { id: '13', imageUrl: '/images/gallery/ai-animation-ghibli.webp' },
  { id: '14', imageUrl: '/images/gallery/test-sample.png' },
  { id: '15', imageUrl: '/images/gallery/sample-timestamp-1.png' },
  { id: '16', imageUrl: '/images/gallery/sample-timestamp-2.png' },
  { id: '17', imageUrl: '/images/gallery/sample-uuid-1.png' },
  { id: '18', imageUrl: '/images/gallery/sample-uuid-2.png' },
];

const ROW_1 = GALLERY_ITEMS.slice(0, 9);
const ROW_2 = GALLERY_ITEMS.slice(9);

interface GalleryCardProps {
  item: GalleryItem;
}

function GalleryCard({ item }: GalleryCardProps) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative flex-shrink-0 group cursor-pointer"
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl bg-white dark:bg-[#1e293b]',
          'h-56 md:h-72 w-auto',
          'ring-1 ring-[#e2e8f0] dark:ring-[#334155]',
          'transition-all duration-300',
          'group-hover:ring-[#0052ff]/30 dark:group-hover:ring-[#3d8bff]/30'
        )}
        style={{
          boxShadow:
            '0 10px 30px -10px rgba(0, 0, 0, 0.1), 0 4px 15px -5px rgba(0, 82, 255, 0.08)',
        }}
      >
        <Image
          src={item.imageUrl}
          alt="AI generated artwork"
          width={400}
          height={300}
          className="h-full w-auto object-contain transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          quality={75}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0052ff]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
    </motion.div>
  );
}

interface MarqueeRowProps {
  items: GalleryItem[];
  direction?: 'left' | 'right';
  duration?: number;
}

function MarqueeRow({
  items,
  direction = 'left',
  duration = 40,
}: MarqueeRowProps) {
  const duplicatedItems = [...items, ...items, ...items];

  return (
    <div className="relative overflow-hidden py-3">
      <div
        className={cn(
          'flex gap-5 w-max backface-hidden',
          direction === 'left'
            ? 'animate-marquee-left'
            : 'animate-marquee-right'
        )}
        style={
          {
            '--duration': `${duration}s`,
            willChange: 'transform',
            transform: 'translateZ(0)',
          } as React.CSSProperties
        }
      >
        {duplicatedItems.map((item, index) => (
          <GalleryCard key={`${item.id}-${index}`} item={item} />
        ))}
      </div>

      {/* Gradient masks */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#f8fafc] dark:from-[#0a0f1a] to-transparent pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#f8fafc] dark:from-[#0a0f1a] to-transparent pointer-events-none z-10" />
    </div>
  );
}

export function GallerySection() {
  const t = useTranslations('LandingPage.gallery');

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden bg-[#f8fafc] dark:bg-[#0a0f1a]">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-gradient-to-br from-[#0052ff]/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] bg-gradient-to-tl from-[#3d8bff]/5 to-transparent rounded-full blur-3xl" />

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-14 lg:mb-18"
        >
          {/* Icon badge */}
          <div className="inline-flex items-center justify-center gap-3 mb-5">
            <div className="size-12 bg-gradient-to-br from-[#0052ff]/10 to-[#3d8bff]/5 rounded-2xl flex items-center justify-center border border-[#0052ff]/10">
              <Sparkles className="size-6 text-[#0052ff] dark:text-[#3d8bff]" />
            </div>
          </div>

          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('title')}
            </span>
          </h2>

          <p className="text-[#64748b] dark:text-[#94a3b8] text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </motion.div>
      </div>

      {/* Marquee rows */}
      <div className="space-y-5">
        <MarqueeRow items={ROW_1} direction="left" duration={50} />
        <MarqueeRow items={ROW_2} direction="right" duration={60} />
      </div>

      {/* Footer hint */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center text-[#94a3b8] dark:text-[#64748b] text-sm mt-12"
        >
          {t('hint')}
        </motion.p>
      </div>
    </section>
  );
}
