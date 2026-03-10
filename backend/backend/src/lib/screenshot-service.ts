/**
 * 截图服务
 * 使用 Playwright 自动截取网站的 Logo 和缩略图
 * 仅在开发环境启用
 */

import { chromium } from 'playwright';

/**
 * 检查是否启用自动截图
 * 仅在开发环境且配置启用时返回 true
 */
export const isScreenshotEnabled = (): boolean => {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.ENABLE_AUTO_SCREENSHOT === 'true'
  );
};

/**
 * 获取截图超时设置（秒）
 */
const getScreenshotTimeout = (): number => {
  const timeout = Number.parseInt(process.env.SCREENSHOT_TIMEOUT || '30', 10);
  return timeout * 1000; // 转换为毫秒
};

/**
 * 截取网站 Logo
 * 尝试查找 logo 元素，如果找不到则下载 favicon
 *
 * @param url - 网站 URL
 * @returns Logo 图片的 Buffer，失败返回 null
 */
export async function captureWebsiteLogo(url: string): Promise<Buffer | null> {
  if (!isScreenshotEnabled()) {
    console.log('Screenshot service is disabled');
    return null;
  }

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    const timeout = getScreenshotTimeout();

    // 访问网站
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout,
    });

    // 尝试查找 logo 元素
    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[class*="logo" i]',
      'img[id*="logo" i]',
      'a.logo img',
      'header img:first-of-type',
      '.header img:first-of-type',
      '.navbar img:first-of-type',
    ];

    for (const selector of logoSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          // 检查图片是否可见且有合理的尺寸
          const box = await element.boundingBox();
          if (box && box.width >= 20 && box.height >= 20) {
            const screenshot = await element.screenshot({
              type: 'png',
            });
            await browser.close();
            return screenshot;
          }
        }
      } catch (error) {
        // 继续尝试下一个选择器
        continue;
      }
    }

    // 如果找不到 logo 元素，尝试下载 favicon
    try {
      const faviconUrl = await page.evaluate(() => {
        const link =
          document.querySelector<HTMLLinkElement>('link[rel*="icon"]');
        return link?.href;
      });

      if (faviconUrl) {
        const response = await page.goto(faviconUrl, { timeout: 10000 });
        if (response && response.ok()) {
          const buffer = await response.body();
          await browser.close();
          return buffer;
        }
      }
    } catch (error) {
      console.error('Failed to download favicon:', error);
    }

    await browser.close();
    return null;
  } catch (error) {
    console.error('Failed to capture website logo:', error);
    if (browser) {
      await browser.close();
    }
    return null;
  }
}

/**
 * 截取网站缩略图
 * 截取视口截图（1280x720）
 *
 * @param url - 网站 URL
 * @returns 缩略图的 Buffer，失败返回 null
 */
export async function captureWebsiteThumbnail(
  url: string
): Promise<Buffer | null> {
  if (!isScreenshotEnabled()) {
    console.log('Screenshot service is disabled');
    return null;
  }

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    const timeout = getScreenshotTimeout();

    // 访问网站
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout,
    });

    // 等待额外 2 秒确保动态内容加载
    await page.waitForTimeout(2000);

    // 截取视口截图
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    await browser.close();
    return screenshot;
  } catch (error) {
    console.error('Failed to capture website thumbnail:', error);
    if (browser) {
      await browser.close();
    }
    return null;
  }
}
