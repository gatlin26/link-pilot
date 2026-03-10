import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * https://nextjs.org/docs/app/api-reference/config/next-config-js
 */
const nextConfig: NextConfig = {
  // 启用 gzip 压缩以减少传输大小
  compress: true,

  // 跳过构建时的 TypeScript 类型检查（开发时仍会检查）
  typescript: {
    ignoreBuildErrors: true,
  },

  // 配置 webpack 处理 .txt 文件作为 raw 文本导入
  webpack: (config) => {
    config.module.rules.push({
      test: /\.txt$/,
      type: 'asset/source',
    });
    return config;
  },
  // Docker standalone output
  ...(process.env.DOCKER_BUILD === 'true' && { output: 'standalone' }),

  /* config options here */
  devIndicators: false,

  /**
   * Server Actions 默认 bodySizeLimit 为 1MB。
   * 我们的图片增强通过 Server Action 直接提交 File（FormData），必须放宽限制，否则会 413。
   * 保持与前端/后端已有的 10MB 校验一致（见 MAX_IMAGE_SIZE_BYTES=10MB）。
   */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // https://nextjs.org/docs/architecture/nextjs-compiler#remove-console
  // Remove all console.* calls in production only
  compiler: {
    // removeConsole: process.env.NODE_ENV === 'production',
  },

  images: {
    // https://vercel.com/docs/image-optimization/managing-image-optimization-costs#minimizing-image-optimization-costs
    // https://nextjs.org/docs/app/api-reference/components/image#unoptimized
    // vercel has limits on image optimization, 1000 images per month
    unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === 'true',

    // 优化图片格式和缓存以降低成本
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 缓存 1 年

    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'randomuser.me',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
      },
      {
        protocol: 'https',
        hostname: 'html.tailus.io',
      },
      {
        protocol: 'https',
        hostname: 'service.firecrawl.dev',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 's.vidlyo.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's.buildway.cc',
        pathname: '/**',
      },
    ],
  },
};

/**
 * You can specify the path to the request config file or use the default one (@/i18n/request.ts)
 *
 * https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing#next-config
 */
const withNextIntl = createNextIntlPlugin();

/**
 * https://fumadocs.dev/docs/ui/manual-installation
 * https://fumadocs.dev/docs/mdx/plugin
 */
const withMDX = createMDX();

export default withMDX(withNextIntl(nextConfig));
