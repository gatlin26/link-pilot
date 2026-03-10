import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 为URL添加UTM参数
 * @param url - 原始URL
 * @param utmParams - UTM参数对象，默认为 { utm_source: 'buildway' }
 * @returns 添加了UTM参数的URL
 */
export function addUtmParams(
  url: string,
  utmParams: Record<string, string> = { utm_source: 'buildway' }
): string {
  if (!url) return url;

  try {
    const urlObj = new URL(url);

    // 添加UTM参数
    for (const [key, value] of Object.entries(utmParams)) {
      urlObj.searchParams.set(key, value);
    }

    return urlObj.toString();
  } catch {
    // 如果URL无效，返回原始URL
    return url;
  }
}
