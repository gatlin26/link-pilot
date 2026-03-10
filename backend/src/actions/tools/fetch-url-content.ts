'use server';

import { adminActionClient } from '@/lib/safe-action';
import { z } from 'zod';

const fetchUrlContentSchema = z.object({
  url: z.string().url('Valid URL is required'),
});

/**
 * 爬取 URL 内容（仅管理员）
 * 提取网页的主要文本内容作为参考资料
 */
export const fetchUrlContentAction = adminActionClient
  .schema(fetchUrlContentSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { url } = parsedInput;

      // 设置超时和请求头
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
        };
      }

      const html = await response.text();

      // 提取文本内容
      const content = extractTextContent(html);

      if (!content || content.length < 50) {
        return {
          success: false,
          error: 'Unable to extract meaningful content from the page',
        };
      }

      return {
        success: true,
        data: {
          content,
          url,
        },
      } as const;
    } catch (error) {
      console.error('fetch url content error:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout - the page took too long to respond',
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: 'Failed to fetch URL content',
      };
    }
  });

/**
 * 从 HTML 中提取主要文本内容
 */
function extractTextContent(html: string): string {
  // 移除 script 和 style 标签及其内容
  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

  // 提取 title
  const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // 提取 meta description
  const descMatch =
    text.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
    ) ||
    text.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i
    );
  const description = descMatch ? descMatch[1].trim() : '';

  // 提取 og:description
  const ogDescMatch =
    text.match(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i
    ) ||
    text.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i
    );
  const ogDescription = ogDescMatch ? ogDescMatch[1].trim() : '';

  // 尝试提取 main/article 内容
  const mainMatch =
    text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

  let bodyContent = '';
  if (mainMatch) {
    bodyContent = mainMatch[1];
  } else {
    // 提取 body 内容
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    bodyContent = bodyMatch ? bodyMatch[1] : text;
  }

  // 移除导航、页脚、侧边栏等
  bodyContent = bodyContent
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

  // 移除所有 HTML 标签
  bodyContent = bodyContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // 组合结果
  const parts: string[] = [];

  if (title) {
    parts.push(`Title: ${title}`);
  }

  if (description) {
    parts.push(`Description: ${description}`);
  } else if (ogDescription) {
    parts.push(`Description: ${ogDescription}`);
  }

  if (bodyContent) {
    // 限制内容长度，避免过长
    const maxLength = 10000;
    const truncatedContent =
      bodyContent.length > maxLength
        ? bodyContent.substring(0, maxLength) + '...'
        : bodyContent;
    parts.push(`\nContent:\n${truncatedContent}`);
  }

  return parts.join('\n');
}
