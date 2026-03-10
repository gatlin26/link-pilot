/**
 * @file testimonials-section.tsx
 * @description Landing 页面用户评价区域
 * @author git.username
 * @date 2025-12-22
 */

'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

const testimonialAvatars = [
  '/images/home/testimonials/avatar-sarah.jpg',
  '/images/home/testimonials/avatar-james.jpg',
  '/images/home/testimonials/avatar-emily.jpg',
];

export function TestimonialsSection() {
  const t = useTranslations('LandingPage.testimonials');

  const testimonials = [
    {
      name: t('items.sarah.name'),
      role: t('items.sarah.role'),
      content: t('items.sarah.content'),
      avatar: testimonialAvatars[0],
    },
    {
      name: t('items.james.name'),
      role: t('items.james.role'),
      content: t('items.james.content'),
      avatar: testimonialAvatars[1],
    },
    {
      name: t('items.emily.name'),
      role: t('items.emily.role'),
      content: t('items.emily.content'),
      avatar: testimonialAvatars[2],
    },
  ];

  return (
    <section className="relative py-32 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-primary text-sm font-semibold uppercase tracking-widest">
            {t('sectionLabel')}
          </span>
          <h2 className="font-serif text-4xl lg:text-5xl font-light mt-4">
            {t('title')}
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative p-8 bg-card/50 border border-border rounded-2xl"
            >
              {/* 引号装饰 */}
              <svg
                className="absolute top-6 right-6 w-10 h-10 text-primary/20"
                fill="currentColor"
                viewBox="0 0 32 32"
              >
                <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8z" />
              </svg>

              {/* 评价内容 */}
              <p className="text-muted-foreground leading-relaxed mb-6 relative z-10">
                &ldquo;{testimonial.content}&rdquo;
              </p>

              {/* 用户信息 */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
                  <Image
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-primary">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
