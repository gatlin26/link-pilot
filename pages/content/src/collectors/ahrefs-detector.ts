/**
 * Ahrefs 页面检测器
 */

/**
 * 检测当前页面是否为 Ahrefs Backlink Checker 页面
 */
export function isAhrefsBacklinkChecker(): boolean {
  const hostname = window.location.hostname;

  // 支持所有 Ahrefs 域名变体
  return hostname === 'ahrefs.com' ||
         hostname === 'www.ahrefs.com' ||
         hostname === 'app.ahrefs.com' ||
         hostname.endsWith('.ahrefs.com');
}

/**
 * 获取 Ahrefs 页面的目标 URL
 */
export function getAhrefsTargetUrl(): string | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const input = urlParams.get('input');
    if (input) {
      return decodeURIComponent(input);
    }
  } catch (error) {
    console.error('[Ahrefs Detector] 获取目标 URL 失败:', error);
  }

  return null;
}

/**
 * 获取 Ahrefs 页面的模式（domain/subdomains/prefix/exact）
 */
export function getAhrefsMode(): string {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') || 'exact';
  } catch {
    return 'exact';
  }
}

/**
 * 检测是否遇到验证页面（验证码、人机验证等）
 * 方案 1：检测并暂停
 */
export function detectVerificationPage(): {
  isVerification: boolean;
  type?: 'captcha' | 'cloudflare' | 'rate_limit' | 'unknown';
  message?: string;
} {
  const url = window.location.href;
  const hostname = window.location.hostname;
  const bodyText = document.body?.innerText?.toLowerCase() || '';
  const title = document.title.toLowerCase();

  // 检测 Cloudflare 验证页面
  if (
    title.includes('just a moment') ||
    title.includes('checking your browser') ||
    bodyText.includes('cloudflare') ||
    document.querySelector('#challenge-form') ||
    document.querySelector('.cf-browser-verification')
  ) {
    return {
      isVerification: true,
      type: 'cloudflare',
      message: '检测到 Cloudflare 验证页面，请完成验证后继续',
    };
  }

  // 检测 reCAPTCHA
  if (
    document.querySelector('.g-recaptcha') ||
    document.querySelector('[data-sitekey]') ||
    bodyText.includes('recaptcha') ||
    document.querySelector('iframe[src*="recaptcha"]')
  ) {
    return {
      isVerification: true,
      type: 'captcha',
      message: '检测到 reCAPTCHA 验证，请完成验证后继续',
    };
  }

  // 检测 hCaptcha
  if (
    document.querySelector('.h-captcha') ||
    document.querySelector('iframe[src*="hcaptcha"]') ||
    bodyText.includes('hcaptcha')
  ) {
    return {
      isVerification: true,
      type: 'captcha',
      message: '检测到 hCaptcha 验证，请完成验证后继续',
    };
  }

  // 检测频率限制页面
  if (
    title.includes('rate limit') ||
    title.includes('too many requests') ||
    bodyText.includes('rate limit') ||
    bodyText.includes('too many requests') ||
    bodyText.includes('请稍后再试')
  ) {
    return {
      isVerification: true,
      type: 'rate_limit',
      message: '检测到频率限制，请稍后再试',
    };
  }

  // 检测 Ahrefs 特定的验证页面
  if (hostname.includes('ahrefs.com')) {
    // 检测是否有验证相关的元素
    if (
      document.querySelector('[class*="captcha"]') ||
      document.querySelector('[id*="captcha"]') ||
      document.querySelector('[class*="verification"]') ||
      document.querySelector('[id*="verification"]')
    ) {
      return {
        isVerification: true,
        type: 'unknown',
        message: '检测到验证页面，请完成验证后继续',
      };
    }

    // 检测是否有错误提示
    if (bodyText.includes('verify') || bodyText.includes('verification') || bodyText.includes('please wait')) {
      return {
        isVerification: true,
        type: 'unknown',
        message: '检测到可能的验证页面，请检查并完成验证',
      };
    }
  }

  return {
    isVerification: false,
  };
}

/**
 * 等待验证完成
 * 返回 Promise，当验证完成后 resolve
 */
export function waitForVerificationComplete(timeoutMs: number = 300000): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = 2000; // 每 2 秒检查一次

    const checkVerification = () => {
      const result = detectVerificationPage();

      if (!result.isVerification) {
        // 验证已完成
        console.log('[Ahrefs Detector] 验证已完成');
        resolve(true);
        return;
      }

      // 检查是否超时
      if (Date.now() - startTime > timeoutMs) {
        console.error('[Ahrefs Detector] 等待验证超时');
        reject(new Error('等待验证超时'));
        return;
      }

      // 继续等待
      setTimeout(checkVerification, checkInterval);
    };

    checkVerification();
  });
}
