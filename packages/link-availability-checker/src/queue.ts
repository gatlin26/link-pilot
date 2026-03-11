/**
 * Batch queue for link availability checking
 * Handles concurrent processing with exponential backoff retry
 */

import type { AvailabilityResult, BatchCheckResult, CheckerConfig, QueueItem } from './types';
import { LinkAvailabilityChecker } from './checker';

/**
 * Queue state
 */
type QueueState = 'idle' | 'processing' | 'paused';

/**
 * Link Availability Queue
 * Manages batch checking with concurrency control and retry logic
 */
export class LinkAvailabilityQueue {
  private queue: QueueItem[] = [];
  private results: AvailabilityResult[] = [];
  private state: QueueState = 'idle';
  private concurrency: number;
  private maxRetries: number;
  private retryDelays: number[];
  private checker: LinkAvailabilityChecker;
  private onProgress?: (completed: number, total: number, result?: AvailabilityResult) => void;

  /**
   * Create a new queue
   */
  constructor(
    config: Partial<CheckerConfig> = {},
    onProgress?: (completed: number, total: number, result?: AvailabilityResult) => void
  ) {
    this.checker = new LinkAvailabilityChecker(config);
    this.concurrency = config.maxConcurrency || 5;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelays = [1000, 2000, 4000]; // Exponential backoff
    this.onProgress = onProgress;
  }

  /**
   * Add URLs to the queue
   */
  addUrls(urls: string[]): void {
    const newItems: QueueItem[] = urls.map((url) => ({
      url,
      retryCount: 0,
    }));
    this.queue.push(...newItems);
    this.results = [];
  }

  /**
   * Start processing the queue
   */
  async process(): Promise<BatchCheckResult> {
    if (this.state === 'processing') {
      throw new Error('Queue is already processing');
    }

    this.state = 'processing';
    const total = this.queue.length;
    let completed = 0;

    try {
      // Process in batches
      while (this.queue.length > 0 && this.state === 'processing') {
        // Get next batch of items (up to concurrency)
        const batch: QueueItem[] = [];
        const activeItems: QueueItem[] = [];

        for (let i = 0; i < this.concurrency && this.queue.length > 0; i++) {
          const item = this.queue.shift();
          if (item) {
            batch.push(item);
          }
        }

        // Process batch concurrently
        const promises = batch.map(async (item) => {
          try {
            const result = await this.checkWithRetry(item);
            this.results.push(result);
            completed++;

            // Notify progress
            if (this.onProgress) {
              this.onProgress(completed, total, result);
            }

            return result;
          } catch (error) {
            // Mark as unknown on error
            const errorResult: AvailabilityResult = {
              url: item.url,
              status: 'unknown',
              error: error instanceof Error ? error.message : 'Unknown error',
              checkedAt: new Date().toISOString(),
            };
            this.results.push(errorResult);
            completed++;

            if (this.onProgress) {
              this.onProgress(completed, total, errorResult);
            }

            return errorResult;
          }
        });

        await Promise.all(promises);
      }
    } finally {
      this.state = 'idle';
    }

    return this.getResults();
  }

  /**
   * Check URL with retry logic
   */
  private async checkWithRetry(item: QueueItem): Promise<AvailabilityResult> {
    while (item.retryCount <= this.maxRetries) {
      try {
        const result = await this.checker.check(item.url);

        // If successful or definitively dead, return
        if (result.status !== 'unknown') {
          return result;
        }

        // Unknown status - retry
        item.retryCount++;
        item.lastAttempt = new Date().toISOString();

        if (item.retryCount <= this.maxRetries) {
          const delay = this.retryDelays[item.retryCount - 1] || this.retryDelays[this.retryDelays.length - 1];
          await this.sleep(delay);
        }
      } catch (error) {
        item.retryCount++;
        item.error = error instanceof Error ? error.message : 'Unknown error';
        item.lastAttempt = new Date().toISOString();

        if (item.retryCount <= this.maxRetries) {
          const delay = this.retryDelays[item.retryCount - 1] || this.retryDelays[this.retryDelays.length - 1];
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    return {
      url: item.url,
      status: 'unknown',
      error: `Max retries (${this.maxRetries}) exceeded`,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Pause processing
   */
  pause(): void {
    if (this.state === 'processing') {
      this.state = 'paused';
    }
  }

  /**
   * Resume processing
   */
  resume(): void {
    if (this.state === 'paused') {
      this.state = 'processing';
      this.process();
    }
  }

  /**
   * Stop processing
   */
  stop(): void {
    this.state = 'idle';
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.results = [];
    this.state = 'idle';
  }

  /**
   * Get current results
   */
  getResults(): BatchCheckResult {
    const alive = this.results.filter((r) => r.status === 'alive').length;
    const dead = this.results.filter((r) => r.status === 'dead').length;
    const unknown = this.results.filter((r) => r.status === 'unknown').length;

    return {
      total: this.results.length,
      alive,
      dead,
      unknown,
      results: this.results,
    };
  }

  /**
   * Get queue status
   */
  getStatus(): {
    state: QueueState;
    pending: number;
    completed: number;
  } {
    return {
      state: this.state,
      pending: this.queue.length,
      completed: this.results.length,
    };
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a new queue instance
 */
export function createQueue(
  config?: Partial<CheckerConfig>,
  onProgress?: (completed: number, total: number, result?: AvailabilityResult) => void
): LinkAvailabilityQueue {
  return new LinkAvailabilityQueue(config, onProgress);
}
