/**
 * 异步操作辅助工具
 * 提供超时控制、重试等功能
 *
 * @author yiangto
 * @date 2026-03-13
 */

import { TimeoutError } from './errors.js';

/**
 * 为 Promise 添加超时控制
 * 如果操作在指定时间内未完成，会抛出 TimeoutError
 *
 * @param promise - 要执行的 Promise
 * @param timeoutMs - 超时时间（毫秒）
 * @param errorMessage - 超时错误消息
 * @returns 带超时控制的 Promise
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetchData(),
 *   5000,
 *   '数据获取超时'
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = '操作超时',
): Promise<T> {
  let timeoutId: NodeJS.Timeout | number | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId as NodeJS.Timeout);
    }
  }
}

/**
 * 延迟执行
 * @param ms - 延迟时间（毫秒）
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试配置
 */
export interface RetryOptions {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  delayMs?: number;
  /** 是否使用指数退避 */
  exponentialBackoff?: boolean;
  /** 判断是否应该重试的函数 */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * 带重试的异步操作
 * @param fn - 要执行的函数
 * @param options - 重试配置
 * @returns Promise
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, delayMs: 1000, exponentialBackoff: true }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxRetries,
    delayMs = 1000,
    exponentialBackoff = false,
    shouldRetry = () => true,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 如果是最后一次尝试，或者不应该重试，直接抛出错误
      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      // 计算延迟时间
      const currentDelay = exponentialBackoff ? delayMs * Math.pow(2, attempt) : delayMs;

      // 等待后重试
      await delay(currentDelay);
    }
  }

  throw lastError!;
}

/**
 * 批量执行异步操作，控制并发数
 * @param items - 要处理的项目列表
 * @param fn - 处理函数
 * @param concurrency - 并发数
 * @returns Promise
 *
 * @example
 * ```typescript
 * const results = await batchAsync(
 *   urls,
 *   (url) => fetch(url),
 *   5 // 最多同时 5 个请求
 * );
 * ```
 */
export async function batchAsync<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 5,
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    const promise = fn(item, i).then((result) => {
      results[i] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // 移除已完成的 Promise
      executing.splice(
        executing.findIndex((p) => p === promise),
        1,
      );
    }
  }

  // 等待所有剩余的 Promise 完成
  await Promise.all(executing);

  return results;
}
