'use server';

import { randomUUID } from 'crypto';
import { userActionClient } from '@/lib/safe-action';
import { uploadFile } from '@/storage';
import { chromium } from 'playwright';
import { z } from 'zod';

const fetchWebsiteAssetsSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
});

interface FetchResult {
  success: boolean;
  iconUrl?: string;
  screenshotUrl?: string;
  error?: string;
}

/**
 * 从网站URL自动抓取logo和截图
 */
export const fetchWebsiteAssetsAction = userActionClient
  .schema(fetchWebsiteAssetsSchema)
  .action(async ({ parsedInput }): Promise<FetchResult> => {
    const { url } = parsedInput;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

    try {
      // 启动浏览器
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const context = await browser.newContext({
        viewport: {
          width: 1920,
          height: 1080,
        },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // 访问网站
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // 等待页面加载完成
      await page.waitForTimeout(2000);

      // 1. 获取网站favicon/logo
      let iconUrl: string | undefined;
      try {
        // 尝试多种方式获取logo
        const iconHref = await page.evaluate(() => {
          // 尝试获取 apple-touch-icon
          const appleTouchIcon = document.querySelector<HTMLLinkElement>(
            'link[rel="apple-touch-icon"]'
          );
          if (appleTouchIcon?.href) return appleTouchIcon.href;

          // 尝试获取 icon
          const icon =
            document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (icon?.href) return icon.href;

          // 尝试获取 shortcut icon
          const shortcutIcon = document.querySelector<HTMLLinkElement>(
            'link[rel="shortcut icon"]'
          );
          if (shortcutIcon?.href) return shortcutIcon.href;

          // 默认尝试 /favicon.ico
          return null;
        });

        // 如果找到了icon链接，下载并上传到storage
        if (iconHref) {
          const iconResponse = await fetch(iconHref);
          if (iconResponse.ok) {
            const iconBuffer = await iconResponse.arrayBuffer();
            const iconResult = await uploadFile(
              Buffer.from(iconBuffer),
              `${randomUUID()}.png`,
              'image/png',
              'logos'
            );
            iconUrl = iconResult.url;
          }
        }

        // 如果没有找到，尝试默认的 favicon.ico
        if (!iconUrl) {
          const urlObj = new URL(url);
          const faviconUrl = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
          try {
            const faviconResponse = await fetch(faviconUrl);
            if (faviconResponse.ok) {
              const faviconBuffer = await faviconResponse.arrayBuffer();
              const faviconResult = await uploadFile(
                Buffer.from(faviconBuffer),
                `${randomUUID()}.ico`,
                'image/x-icon',
                'logos'
              );
              iconUrl = faviconResult.url;
            }
          } catch (error) {
            console.error('Failed to fetch favicon.ico:', error);
          }
        }
      } catch (error) {
        console.error('Failed to fetch icon:', error);
      }

      // 2. 截取网站截图
      let screenshotUrl: string | undefined;
      try {
        const screenshot = await page.screenshot({
          type: 'png',
          fullPage: false, // 只截取首屏
        });

        // 上传截图到storage
        const screenshotResult = await uploadFile(
          Buffer.from(screenshot),
          `${randomUUID()}.png`,
          'image/png',
          'screenshots'
        );
        screenshotUrl = screenshotResult.url;
      } catch (error) {
        console.error('Failed to take screenshot:', error);
      }

      await browser.close();

      // 检查是否至少获取到了一个资源
      if (!iconUrl && !screenshotUrl) {
        return {
          success: false,
          error: '无法获取网站logo和截图，请手动上传',
        };
      }

      return {
        success: true,
        iconUrl,
        screenshotUrl,
      };
    } catch (error) {
      console.error('Failed to fetch website assets:', error);

      // 确保浏览器被关闭
      if (browser) {
        await browser.close();
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : '获取网站资源失败',
      };
    }
  });
