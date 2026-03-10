/**
 * @file sticky-scroll-sections.tsx
 * @description 卡片堆叠式滚动组件 - 参考 Easemate 实现
 * @author git.username
 * @date 2026-01-17
 */

'use client';

import { cn } from '@/lib/utils';

export interface StickySectionTextContent {
  /** 副标题（显示在图标旁边） */
  subtitle?: string;
  /** 图标组件 */
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** 标题 */
  title?: string;
  /** 高亮标题（会显示为紫色） */
  highlightedTitle?: string;
  /** 描述文字 */
  description?: string;
  /** 按钮文字 */
  buttonText?: string;
  /** 按钮链接 */
  buttonHref?: string;
}

export interface StickySection {
  /** Section 的唯一标识 */
  id: string;
  /** Section 的自定义内容（如果提供，将优先使用此内容） */
  content?: React.ReactNode;
  /** 图片配置：单张图片（字符串）或多张图片（数组，用于左右并排对比） */
  images?: string | string[];
  /** 图片 alt 文本 */
  imageAlt?: string | string[];
  /** 文字内容配置（与 images 配合使用） */
  textContent?: StickySectionTextContent;
  /** 背景渐变 */
  background?: string;
  /** 图片位置：左或右（仅当 images 为单张时有效） */
  imagePosition?: 'left' | 'right';
}

interface StickyScrollSectionsProps {
  /** Section 数据数组 */
  sections: StickySection[];
  /** 容器类名 */
  className?: string;
  /** 导航栏高度（用于计算 sticky top） */
  headerHeight?: number;
}

/**
 * 内置图片展示组件
 */
function ImageDisplay({
  images,
  imageAlt,
  textContent,
  imagePosition,
}: {
  images: string | string[];
  imageAlt?: string | string[];
  textContent?: StickySectionTextContent;
  imagePosition?: 'left' | 'right';
}) {
  const isMultiple = Array.isArray(images);
  const imageArray = isMultiple ? images : [images];
  const altArray = Array.isArray(imageAlt)
    ? imageAlt
    : imageAlt
      ? [imageAlt]
      : imageArray.map((_, i) => `Image ${i + 1}`);

  const handleButtonClick = () => {
    if (textContent?.buttonHref) {
      if (textContent.buttonHref.startsWith('#')) {
        const element = document.getElementById(
          textContent.buttonHref.slice(1)
        );
        element?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      } else {
        window.location.href = textContent.buttonHref;
      }
    }
  };

  return (
    <>
      {/* 图片区域 */}
      <div
        className={cn(
          'flex justify-center items-center max-w-full rounded-2xl overflow-hidden',
          // 单张图片时的宽度限制
          !isMultiple && 'lg:max-w-[55%]',
          // 多张图片时横向排列
          isMultiple && 'gap-4 lg:gap-6'
        )}
      >
        {isMultiple ? (
          // 多张图片：左右并排对比
          <div className="flex gap-4 lg:gap-6 w-full max-w-[900px]">
            {imageArray.map((src, index) => (
              <div
                key={index}
                className="flex-1 flex justify-center items-center rounded-2xl overflow-hidden"
              >
                <img
                  src={src}
                  alt={altArray[index] || `对比图 ${index + 1}`}
                  loading="eager"
                  className="rounded-2xl w-full h-auto max-h-[500px] lg:max-h-[450px] object-contain"
                />
              </div>
            ))}
          </div>
        ) : (
          // 单张图片
          <img
            src={imageArray[0]}
            alt={altArray[0] || 'Feature image'}
            loading="eager"
            className="rounded-2xl w-auto h-auto max-w-full max-h-[500px] lg:max-h-[450px] object-contain"
          />
        )}
      </div>

      {/* 文字区域（如果有配置） */}
      {textContent && (
        <section className="w-fit max-w-full lg:max-w-[460px]">
          {/* Icon + Subtitle */}
          {(textContent.subtitle || textContent.icon) && (
            <div className="flex items-center gap-3 mb-4">
              {textContent.icon && (
                <div className="size-11 rounded-xl bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 flex items-center justify-center">
                  <textContent.icon
                    className="size-5 text-[#0052ff] dark:text-[#3d8bff]"
                    strokeWidth={1.5}
                  />
                </div>
              )}
              {textContent.subtitle && (
                <span className="text-sm font-bold uppercase tracking-widest text-[#0052ff] dark:text-[#3d8bff]">
                  {textContent.subtitle}
                </span>
              )}
            </div>
          )}

          {(textContent.title || textContent.highlightedTitle) && (
            <h3 className="text-lg lg:text-[32px] leading-6 lg:leading-10 text-[#0f172a] dark:text-white font-bold">
              {textContent.title && <span>{textContent.title}</span>}
              {textContent.highlightedTitle && (
                <span className="text-[#7C3AED]">
                  {' '}
                  {textContent.highlightedTitle}
                </span>
              )}
            </h3>
          )}

          {textContent.description && (
            <div className="text-sm lg:text-base text-[#64748b] dark:text-gray-300 text-wrap font-normal text-left my-5 lg:my-10">
              {textContent.description}
            </div>
          )}

          {textContent.buttonText && (
            <button
              type="button"
              onClick={handleButtonClick}
              className={cn(
                'inline-flex justify-center items-center',
                'bg-gradient-to-r from-[#0052ff] to-[#3d8bff]',
                'hover:from-[#0047e6] hover:to-[#3580f0]',
                'px-11 h-9 lg:h-12 rounded-full',
                'transition-colors duration-300'
              )}
            >
              <span className="text-sm lg:text-base text-white font-bold">
                {textContent.buttonText}
              </span>
            </button>
          )}
        </section>
      )}
    </>
  );
}

/**
 * 卡片堆叠式滚动组件
 *
 * 核心原理（纯 CSS 实现，无需 JS）：
 * 1. 所有卡片都是 sticky 定位，top 值相同
 * 2. z-index 递增，后面的卡片在上面
 * 3. 每个卡片有足够的 margin-bottom 提供滚动空间
 * 4. 滚动时，后面的卡片自然从下方滑上来覆盖前面的卡片
 *
 * 关键点：
 * - 祖先元素不能有 overflow: hidden/auto/scroll
 * - 每个卡片需要有足够的 margin-bottom
 *
 * 使用方式：
 * 1. 自定义内容：提供 content 属性
 * 2. 图片展示：提供 images 和 textContent 属性
 *    - images: 单张图片（字符串）或多张图片（数组，用于左右并排对比）
 *    - textContent: 文字内容配置（标题、描述、按钮等）
 */
export function StickyScrollSections({
  sections,
  className,
  headerHeight = 64,
}: StickyScrollSectionsProps) {
  const totalSections = sections.length;

  return (
    <div
      className={cn(
        // 容器样式 - 不使用 gap，让 margin-bottom 控制间距
        'flex flex-col items-center w-full',
        'py-10 lg:py-20 px-5',
        className
      )}
      aria-label="Animated cards"
    >
      {sections.map((section, index) => {
        const isLast = index === totalSections - 1;
        const isMultipleImages = Array.isArray(section.images);

        // Z 字布局逻辑：
        // 1. 如果用户明确指定了 imagePosition，优先使用用户的设置
        // 2. 如果没有指定，根据索引自动交替（偶数索引：图片在右，奇数索引：图片在左）
        const getImagePosition = () => {
          // 用户明确指定了 imagePosition，优先使用
          if (section.imagePosition) {
            return section.imagePosition;
          }
          // 自动 Z 字布局：偶数索引图片在右，奇数索引图片在左
          return index % 2 === 0 ? 'right' : 'left';
        };

        const imagePosition = getImagePosition();
        const isImageRight = imagePosition === 'right';

        // 决定使用自定义 content 还是内置的图片展示组件
        const renderContent = () => {
          if (section.content) {
            // 优先使用自定义 content（向后兼容）
            return section.content;
          }
          if (section.images) {
            // 使用内置图片展示组件
            return (
              <ImageDisplay
                images={section.images}
                imageAlt={section.imageAlt}
                textContent={section.textContent}
                imagePosition={imagePosition}
              />
            );
          }
          return null;
        };

        return (
          <div
            key={section.id}
            className={cn(
              // 基础样式
              'flex justify-center items-center gap-8 lg:gap-20 rounded-3xl',
              'w-full p-5 lg:p-10 lg:px-20',
              // 移动端样式 - 正常流式布局
              'relative flex-col-reverse h-auto mb-6',
              // ===== 桌面端样式 =====
              // sticky 定位 - 所有卡片粘在同一位置
              'lg:sticky',
              // 卡片高度 - 接近全屏高度
              'lg:min-h-[calc(100vh-80px)]',
              // margin-bottom 提供滚动空间
              // 非最后一个卡片：70vh 让下一个卡片有足够空间滑上来
              // 最后一个卡片：也需要一定的 margin 让它能正常脱离 sticky 并与下一个 section 衔接
              !isLast ? 'lg:mb-[70vh]' : 'lg:mb-[30vh]',
              // Z 字布局：图片在右时使用 flex-row-reverse，图片在左时使用 flex-row
              isImageRight ? 'lg:flex-row-reverse' : 'lg:flex-row',
              // 背景
              section.background ||
                'bg-gradient-to-r from-[#F5F1FF] via-[#F3F3FF] to-[#E5F6FF] dark:from-[#1e1b4b] dark:via-[#1e293b] dark:to-[#172554]'
            )}
            style={{
              // sticky top 位置 - 紧贴导航栏下方
              top: `${headerHeight}px`,
              // z-index 递增 - 后面的卡片在上面，这样滚动时会覆盖前面的
              zIndex: index + 1,
            }}
          >
            {renderContent()}
          </div>
        );
      })}
    </div>
  );
}
