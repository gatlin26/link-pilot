'use server';

import { z } from 'zod';

const verifyBacklinkSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
});

// 缓存验证结果（避免重复抓取）
const verificationCache = new Map<
  string,
  { verified: boolean; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 验证用户网站是否包含外链
 * 使用简单的 fetch 抓取网页内容，检查是否包含我们的域名
 */
export async function verifyBacklinkAction(url: string) {
  try {
    const parsed = verifyBacklinkSchema.safeParse({ url });
    if (!parsed.success) {
      return { success: false, error: 'Invalid URL' };
    }

    const targetUrl = parsed.data.url;
    const rootDomain = 'buildway.cc';

    // 检查缓存
    const cached = verificationCache.get(targetUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { success: true, verified: cached.verified };
    }

    // 抓取用户网站
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'BuildWay-Backlink-Checker/1.0',
      },
      // 5秒超时
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch website: ${response.status}`,
      };
    }

    const html = await response.text();

    // 匹配 a 标签 href 中包含我们的根域名（兼容 www 和 non-www）
    const backlinkPattern = new RegExp(
      `<a[^>]*href=["']https?://(www\\.)?${rootDomain.replace(/\./g, '\\.')}[^"']*["'][^>]*>`,
      'i'
    );

    const hasBacklink = backlinkPattern.test(html);

    // 缓存结果
    verificationCache.set(targetUrl, {
      verified: hasBacklink,
      timestamp: Date.now(),
    });

    return {
      success: true,
      verified: hasBacklink,
      message: hasBacklink
        ? 'Backlink verified successfully!'
        : 'No backlink found. Please add a link to our site and try again.',
    };
  } catch (error) {
    console.error('[VerifyBacklink] Error:', error);
    let errorMessage = 'Failed to verify backlink. Please try again.';
    if (error instanceof Error) {
      if (
        error.name === 'AbortError' ||
        error.message.toLowerCase().includes('timeout')
      ) {
        errorMessage =
          'Website took too long to respond. Please check the URL and try again.';
      } else if (
        error.message === 'fetch failed' ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNRESET')
      ) {
        errorMessage =
          'Could not reach your website. Please check the URL is publicly accessible.';
      }
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * 检查 URL 是否已有验证缓存
 */
export async function getBacklinkVerificationStatus(url: string) {
  const cached = verificationCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { success: true, verified: cached.verified, cached: true };
  }
  return { success: true, verified: false, cached: false };
}
