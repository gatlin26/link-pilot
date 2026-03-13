/**
 * 统一错误类型定义
 * 为不同模块提供一致的错误处理机制
 *
 * @author yiangto
 * @date 2026-03-13
 */

/**
 * 字段分析错误
 * 在表单字段分析过程中发生的错误
 */
export class FieldAnalysisError extends Error {
  constructor(
    message: string,
    public readonly element?: Element,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'FieldAnalysisError';
    // 保持正确的原型链
    Object.setPrototypeOf(this, FieldAnalysisError.prototype);
  }
}

/**
 * 表单检测错误
 * 在表单检测过程中发生的错误
 */
export class FormDetectionError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'FormDetectionError';
    Object.setPrototypeOf(this, FormDetectionError.prototype);
  }
}

/**
 * 填充策略错误
 * 在表单字段填充过程中发生的错误
 */
export class FillStrategyError extends Error {
  constructor(
    message: string,
    public readonly element?: Element,
    public readonly strategy?: string,
  ) {
    super(message);
    this.name = 'FillStrategyError';
    Object.setPrototypeOf(this, FillStrategyError.prototype);
  }
}

/**
 * Shadow DOM 检测错误
 * 在 Shadow DOM 遍历过程中发生的错误
 */
export class ShadowDOMError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'ShadowDOMError';
    Object.setPrototypeOf(this, ShadowDOMError.prototype);
  }
}

/**
 * 超时错误
 * 异步操作超时时抛出
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs?: number,
  ) {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * 检查错误是否为特定类型
 */
export function isErrorType<T extends Error>(
  error: unknown,
  errorClass: new (...args: any[]) => T,
): error is T {
  return error instanceof errorClass;
}
