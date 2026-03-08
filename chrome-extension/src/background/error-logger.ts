/**
 * 错误日志服务
 */

interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  details?: unknown;
  stack?: string;
}

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 1000;

  /**
   * 记录错误
   */
  error(category: string, message: string, details?: unknown, error?: Error): void {
    this.log('error', category, message, details, error);
  }

  /**
   * 记录警告
   */
  warning(category: string, message: string, details?: unknown): void {
    this.log('warning', category, message, details);
  }

  /**
   * 记录信息
   */
  info(category: string, message: string, details?: unknown): void {
    this.log('info', category, message, details);
  }

  /**
   * 记录日志
   */
  private log(
    level: 'error' | 'warning' | 'info',
    category: string,
    message: string,
    details?: unknown,
    error?: Error,
  ): void {
    const log: ErrorLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
      stack: error?.stack,
    };

    this.logs.push(log);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 输出到控制台
    const consoleMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    consoleMethod(`[${category}] ${message}`, details || '');

    if (error) {
      console.error(error);
    }
  }

  /**
   * 获取所有日志
   */
  getLogs(filter?: { level?: string; category?: string; limit?: number }): ErrorLog[] {
    let filtered = this.logs;

    if (filter?.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }

    if (filter?.category) {
      filtered = filtered.filter(log => log.category === filter.category);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * 导出日志
   */
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const errorLogger = new ErrorLogger();

/**
 * 全局错误处理
 */
if (typeof window !== 'undefined') {
  window.addEventListener('error', event => {
    errorLogger.error(
      'global',
      '未捕获的错误',
      {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      event.error,
    );
  });

  window.addEventListener('unhandledrejection', event => {
    errorLogger.error(
      'global',
      '未处理的 Promise 拒绝',
      {
        reason: event.reason,
      },
    );
  });
}
