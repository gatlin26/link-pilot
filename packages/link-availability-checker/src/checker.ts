/**
 * Link availability checker implementation
 */

import type { AvailabilityResult, AvailabilityStatus, CheckerConfig } from './types';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CheckerConfig = {
  timeout: 5000,
  maxRetries: 3,
  retryDelay: 1000,
  maxConcurrency: 5,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/**
 * Link Availability Checker
 * Checks if a URL is alive by making HTTP requests
 */
export class LinkAvailabilityChecker {
  private config: CheckerConfig;

  constructor(config: Partial<CheckerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a URL is available
   * First tries HEAD request, falls back to GET on timeout
   */
  async check(url: string): Promise<AvailabilityResult> {
    const startTime = Date.now();

    // Try HEAD request first (fastest)
    const headResult = await this.tryHeadRequest(url);

    if (headResult.status !== 'unknown') {
      return {
        ...headResult,
        responseTime: Date.now() - startTime,
      };
    }

    // HEAD failed or timed out, try GET request
    const getResult = await this.tryGetRequest(url);

    return {
      ...getResult,
      responseTime: Date.now() - startTime,
    };
  }

  /**
   * Try HEAD request
   */
  private async tryHeadRequest(url: string): Promise<AvailabilityResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': this.config.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      return this.processResponse(url, response);
    } catch (error) {
      // Check if it's a timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        return this.createUnknownResult(url, 'Request timeout');
      }

      // Check if it's a method not allowed error (some sites don't support HEAD)
      if (error instanceof Error && error.message.includes('method not allowed')) {
        return this.createUnknownResult(url, 'HEAD not supported');
      }

      return this.createUnknownResult(
        url,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Try GET request (fallback)
   */
  private async tryGetRequest(url: string): Promise<AvailabilityResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': this.config.userAgent,
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      return this.processResponse(url, response);
    } catch (error) {
      return this.createUnknownResult(
        url,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Process HTTP response
   */
  private processResponse(url: string, response: Response): AvailabilityResult {
    const statusCode = response.status;
    const contentType = response.headers.get('content-type') || undefined;
    const contentLengthHeader = response.headers.get('content-length');
    const contentLength = contentLengthHeader
      ? parseInt(contentLengthHeader, 10)
      : undefined;

    let status: AvailabilityStatus;

    if (statusCode >= 200 && statusCode < 400) {
      status = 'alive';
    } else if (statusCode >= 400 && statusCode < 500) {
      status = 'dead';
    } else if (statusCode >= 500) {
      status = 'dead';
    } else {
      status = 'unknown';
    }

    return {
      url,
      status,
      statusCode,
      contentType: contentType?.split(';')[0].trim(),
      contentLength: contentLength && !isNaN(contentLength) ? contentLength : undefined,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Create unknown result
   */
  private createUnknownResult(url: string, error: string): AvailabilityResult {
    return {
      url,
      status: 'unknown',
      error,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Get configuration
   */
  getConfig(): CheckerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CheckerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a default checker instance
 */
export function createChecker(config?: Partial<CheckerConfig>): LinkAvailabilityChecker {
  return new LinkAvailabilityChecker(config);
}
