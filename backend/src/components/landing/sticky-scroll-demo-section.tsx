/**
 * @file sticky-scroll-demo-section.tsx
 * @description 卡片堆叠式滚动演示 Section - 参考 Easemate 风格
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import {
  StickyScrollSections,
  type StickySection,
} from '@/components/landing/sticky-scroll-sections';

/**
 * 卡片内容组件
 */
function CardContent({
  title,
  highlightedTitle,
  description,
  buttonText,
  buttonHref,
  imageSrc,
  imageAlt,
}: {
  title: string;
  highlightedTitle: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  imageSrc: string;
  imageAlt: string;
}) {
  return (
    <>
      {/* 图片区域 */}
      <div className="flex justify-center items-center max-w-full rounded-2xl overflow-hidden">
        <img
          width={900}
          height={530}
          alt={imageAlt}
          loading="eager"
          src={imageSrc}
          className="rounded-2xl w-full max-w-[900px]"
          style={{ aspectRatio: '900 / 530' }}
        />
      </div>

      {/* 文字区域 */}
      <section className="w-fit max-w-full lg:max-w-[460px]">
        <h3 className="text-lg lg:text-[32px] leading-6 lg:leading-10 text-[#26292D] dark:text-white font-bold">
          <span>{title}</span>
          <span className="text-[#7C3AED]"> {highlightedTitle}</span>
        </h3>
        <div className="text-sm lg:text-base text-[#26292D] dark:text-gray-300 text-wrap font-normal text-left my-5 lg:my-10">
          {description}
        </div>
        <a
          href={buttonHref}
          className="inline-flex justify-center items-center bg-[#7C3AED] hover:bg-[#6D28D9] px-11 h-9 lg:h-12 rounded-full transition-colors duration-300"
        >
          <span className="text-sm lg:text-base text-white font-bold">
            {buttonText}
          </span>
        </a>
      </section>
    </>
  );
}

/**
 * 卡片堆叠式滚动演示 Section
 */
export function StickyScrollDemoSection() {
  const sections: StickySection[] = [
    {
      id: 'photo-to-painting',
      imagePosition: 'left', // Z字布局：第2个图片在左
      background:
        'bg-gradient-to-r from-[#F1FFFF] via-[#F3F3FF] to-[#FFF4F4] dark:from-[#042f2e] dark:via-[#1e293b] dark:to-[#450a0a]',
      content: (
        <CardContent
          title="Change Photos to"
          highlightedTitle="Hand-Made Paintings"
          description="Effortlessly add a hand-made painting filter to your images. Swiftly convert your digital photos into high-quality and watermark-free oil paintings, illustrations, or watercolor artwork."
          buttonText="Try for Free"
          buttonHref="#ai-editor"
          imageSrc="/images/features/home_pic_hand-made-paintings.webp"
          imageAlt="Change Photos to Hand-Made Paintings"
        />
      ),
    },
    {
      id: 'photo-to-cartoon',
      imagePosition: 'right', // Z字布局：第3个图片在右
      background:
        'bg-gradient-to-r from-[#FFFAF4] via-[#FAFFF1] to-[#F4FCFF] dark:from-[#451a03] dark:via-[#365314] dark:to-[#164e63]',
      content: (
        <CardContent
          title="Transform Photo into"
          highlightedTitle="Cartoon-Style"
          description="In just one click, transform your photos into favored cartoon styles, such as Disney, Pixar, Simpsons, and Cyberpunk for free! Step into the spotlight on social media."
          buttonText="Try for Free"
          buttonHref="#ai-editor"
          imageSrc="/images/features/home_pic_catoon_style.webp"
          imageAlt="Transform Photo into Cartoon-Style"
        />
      ),
    },
    {
      id: 'photo-to-ghibli',
      imagePosition: 'left', // Z字布局：第4个图片在左
      background:
        'bg-gradient-to-r from-[#F1FFFF] via-[#F3F3FF] to-[#F4FCFF] dark:from-[#042f2e] dark:via-[#1e293b] dark:to-[#083344]',
      content: (
        <CardContent
          title="Convert Photo to"
          highlightedTitle="Ghibli-Style"
          description="Quickly turn your photos into Ghibli-style artwork with lush, hand-drawn animation and vibrant color palettes. Capture every detail in your images and infuse them with whimsical and magical elements."
          buttonText="Try for Free"
          buttonHref="#ai-editor"
          imageSrc="/images/features/home_pic_ghibli_style.webp"
          imageAlt="Convert Photo to Ghibli-Style"
        />
      ),
    },
  ];

  return <StickyScrollSections sections={sections} headerHeight={64} />;
}
