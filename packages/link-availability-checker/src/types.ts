/**
 * Link availability checker types
 */

/**
 * Availability status
 */
export type AvailabilityStatus = 'alive' | 'dead' | 'unknown';

/**
 * Result of a link availability check
 */
export interface AvailabilityResult {
  url: string;
  status: AvailabilityStatus;
  statusCode?: number;
  contentType?: string;
  contentLength?: number;
  responseTime?: number;
  error?: string;
  checkedAt: string;
}

/**
 * Configuration for the availability checker
 */
export interface CheckerConfig {
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum number of retries for failed requests */
  maxRetries: number;
  /** Base delay for exponential backoff in milliseconds */
  retryDelay: number;
  /** Maximum concurrent requests */
  maxConcurrency: number;
  /** User agent string */
  userAgent: string;
}

/**
 * Queue item for batch processing
 */
export interface QueueItem {
  url: string;
  retryCount: number;
  lastAttempt?: string;
  error?: string;
}

/**
 * Batch check result
 */
export interface BatchCheckResult {
  total: number;
  alive: number;
  dead: number;
  unknown: number;
  results: AvailabilityResult[];
}
