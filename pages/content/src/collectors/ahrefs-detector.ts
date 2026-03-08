/**
 * Ahrefs 页面检测器
 */

/**
 * 检测当前页面是否为 Ahrefs Backlink Checker 页面
 */
export function isAhrefsBacklinkChecker(): boolean {
  const url = window.location.href;
  const hostname = window.location.hostname;

  // 检查域名
  if (!hostname.includes('ahrefs.com')) {
    return false;
  }

  // 检查路径
  if (!url.includes('/backlink-checker')) {
    return false;
  }

  return true;
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
