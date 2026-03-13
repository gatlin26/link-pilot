/**
 * 统一日志系统
 * 提供分级日志、结构化日志和错误堆栈收集功能
 *
 * @author yiangto
 * @date 2026-03-13
 */

/** 日志级别 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/** 日志配置 */
interface LoggerConfig {
  /** 最小日志级别 */
  minLevel: LogLevel;
  /** 是否启用日志 */
  enabled: boolean;
  /** 日志前缀 */
  prefix?: string;
  /** 是否显示时间戳 */
  showTimestamp?: boolean;
}

/** 日志上下文信息 */
interface LogContext {
  [key: string]: any;
}

/** 日志记录 */
interface LogRecord {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: number;
  error?: Error;
}

/**
 * 日志管理器类
 */
class Logger {
  private config: LoggerConfig;
  private logHistory: LogRecord[] = [];
  private maxHistorySize = 100;

  constructor(config?: Partial<LoggerConfig>) {
    // 默认配置：开发环境显示所有日志，生产环境只显示 warn 和 error
    const isDev = process.env.NODE_ENV === 'development';

    this.config = {
      minLevel: isDev ? LogLevel.DEBUG : LogLevel.WARN,
      enabled: true,
      prefix: '[LinkPilot]',
      showTimestamp: isDev,
      ...config,
    };
  }

  /**
   * 更新配置
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }

  /**
   * Debug 级别日志
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info 级别日志
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warn 级别日志
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Error 级别日志
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    // 检查是否启用日志
    if (!this.config.enabled) {
      return;
    }

    // 检查日志级别
    if (level < this.config.minLevel) {
      return;
    }

    // 创建日志记录
    const record: LogRecord = {
      level,
      message,
      context,
      timestamp: Date.now(),
      error,
    };

    // 保存到历史记录
    this.saveToHistory(record);

    // 输出到控制台
    this.outputToConsole(record);
  }

  /**
   * 保存到历史记录
   */
  private saveToHistory(record: LogRecord): void {
    this.logHistory.push(record);

    // 限制历史记录大小
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(record: LogRecord): void {
    const { level, message, context, error } = record;

    // 构建日志消息
    const parts: string[] = [];

    // 添加前缀
    if (this.config.prefix) {
      parts.push(this.config.prefix);
    }

    // 添加时间戳
    if (this.config.showTimestamp) {
      const time = new Date(record.timestamp).toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      });
      parts.push(`[${time}]`);
    }

    // 添加级别标签
    parts.push(`[${LogLevel[level]}]`);

    // 添加消息
    parts.push(message);

    const logMessage = parts.join(' ');

    // 根据级别选择控制台方法
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, context || '');
        break;
      case LogLevel.INFO:
        console.info(logMessage, context || '');
        break;
      case LogLevel.WARN:
        console.warn(logMessage, context || '');
        break;
      case LogLevel.ERROR:
        console.error(logMessage, context || '');
        if (error) {
          console.error('错误堆栈:', error.stack || error);
        }
        break;
    }
  }

  /**
   * 获取日志历史
   */
  getHistory(level?: LogLevel): LogRecord[] {
    if (level !== undefined) {
      return this.logHistory.filter(record => record.level === level);
    }
    return [...this.logHistory];
  }

  /**
   * 清空日志历史
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * 导出日志历史为 JSON
   */
  exportHistory(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }
}

/**
 * 默认日志实例
 */
export const logger = new Logger();

/**
 * 创建带命名空间的日志实例
 */
export function createLogger(namespace: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger({
    ...config,
    prefix: `[LinkPilot:${namespace}]`,
  });
}
