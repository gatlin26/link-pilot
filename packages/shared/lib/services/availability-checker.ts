/**
 * 可用性检测服务
 */

import { LinkAvailabilityStatus } from '../types/enums.js';

const checkAvailability = (function () {
  // eslint-disable-next-line func-style
  async function impl(url: string): Promise<AvailabilityCheckResult> {
    const result: AvailabilityCheckResult = {
      status: LinkAvailabilityStatus.UNAVAILABLE,
      reachable: false,
      checkedAt: new Date().toISOString(),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      result.reachable = true;
      result.httpStatus = response.status || 0;
      result.status = LinkAvailabilityStatus.AVAILABLE;
    } catch (error) {
      result.reachable = false;
      result.status = LinkAvailabilityStatus.UNAVAILABLE;
      result.lastError = error instanceof Error ? error.message : 'Unknown error';

      if (error instanceof Error && error.name === 'AbortError') {
        result.lastError = '请求超时';
      }
    }

    return result;
  }

  return impl;
})();

const checkAvailabilityBatch = (function () {
  // eslint-disable-next-line func-style
  async function impl(
    urls: string[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<Map<string, AvailabilityCheckResult>> {
    const results = new Map<string, AvailabilityCheckResult>();

    for (let i = 0; i < urls.length; i++) {
      const result = await checkAvailability(urls[i]);
      results.set(urls[i], result);
      onProgress?.(i + 1, urls.length);
    }

    return results;
  }

  return impl;
})();

export interface AvailabilityCheckResult {
  status: LinkAvailabilityStatus.AVAILABLE | LinkAvailabilityStatus.UNAVAILABLE;
  httpStatus?: number;
  reachable: boolean;
  hasForm?: boolean;
  lastError?: string;
  checkedAt: string;
}

export { checkAvailability, checkAvailabilityBatch };
