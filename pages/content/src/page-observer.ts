/**
 * 页面变化监听服务
 * 支持 SPA 页面（React Router、Vue Router 等）
 * @author gatlinyao
 * @date 2025-03-13
 */

/**
 * URL 变化回调函数类型
 */
export type UrlChangeCallback = (url: string) => void;

/**
 * 页面变化监听器
 * 监听 URL 变化，支持传统页面和 SPA 应用
 */
export class PageObserver {
  private lastUrl: string = '';
  private isRunning: boolean = false;
  private mutationObserver: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private readonly debounceMs: number = 300;
  private callbacks: Set<UrlChangeCallback> = new Set();
  // 保存原始 history 方法以便恢复
  private originalPushState?: typeof history.pushState;
  private originalReplaceState?: typeof history.replaceState;

  /**
   * 启动页面监听
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.lastUrl = location.href;

    // 监听 popstate 事件（浏览器前进/后退按钮）
    window.addEventListener('popstate', this.handlePopState);

    // 拦截 history 方法（pushState/replaceState）
    this.hijackHistoryMethods();

    // 启动 MutationObserver 作为备用监听
    this.startMutationObserver();

    console.log('[PageObserver] 页面监听已启动');
  }

  /**
   * 停止页面监听
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // 移除 popstate 监听
    window.removeEventListener('popstate', this.handlePopState);

    // 恢复原始 history 方法
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = undefined;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = undefined;
    }

    // 停止 MutationObserver
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    // 清除防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    console.log('[PageObserver] 页面监听已停止');
  }

  /**
   * 注册 URL 变化回调
   * @param callback 回调函数
   */
  onUrlChange(callback: UrlChangeCallback): void {
    this.callbacks.add(callback);
  }

  /**
   * 移除 URL 变化回调
   * @param callback 回调函数
   */
  offUrlChange(callback: UrlChangeCallback): void {
    this.callbacks.delete(callback);
  }

  /**
   * 获取当前 URL
   * @returns 当前 URL
   */
  getCurrentUrl(): string {
    return location.href;
  }

  /**
   * 获取上次记录的 URL
   * @returns 上次 URL
   */
  getLastUrl(): string {
    return this.lastUrl;
  }

  /**
   * 检查是否正在运行
   * @returns 是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 手动触发 URL 变化处理
   * 用于初始化时立即执行一次
   */
  triggerNow(): void {
    this.handleUrlChange();
  }

  /**
   * 处理 popstate 事件
   */
  private handlePopState = (): void => {
    this.handleUrlChange();
  };

  /**
   * 拦截 history 方法
   * 拦截 pushState 和 replaceState 以检测 SPA 路由变化
   */
  private hijackHistoryMethods(): void {
    // 保存原始方法
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);

    // 拦截 pushState
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      this.originalPushState!(...args);
      this.handleUrlChange();
    };

    // 拦截 replaceState
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      this.originalReplaceState!(...args);
      this.handleUrlChange();
    };
  }

  /**
   * 启动 MutationObserver
   * 作为 URL 变化的备用监听机制
   * 使用节流避免性能问题
   */
  private startMutationObserver(): void {
    // 监听 body 的变化，作为 URL 变化的间接指标
    this.mutationObserver = new MutationObserver(
      this.throttle(() => {
        this.checkUrlChange();
      }, 1000) // 添加节流，1秒内最多触发一次
    );

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: false, // 只监听直接子节点，不监听整个 DOM 树
    });
  }

  /**
   * 节流函数
   * 限制函数执行频率
   */
  private throttle<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number | null = null;
    let lastRan: number | null = null;

    return (...args: Parameters<T>) => {
      if (!lastRan) {
        func(...args);
        lastRan = Date.now();
      } else {
        if (timeout) clearTimeout(timeout);
        timeout = window.setTimeout(() => {
          if (Date.now() - lastRan! >= wait) {
            func(...args);
            lastRan = Date.now();
          }
        }, wait - (Date.now() - lastRan));
      }
    };
  }

  /**
   * 检查 URL 是否发生变化
   */
  private checkUrlChange(): void {
    const currentUrl = location.href;
    if (currentUrl !== this.lastUrl) {
      this.handleUrlChange();
    }
  }

  /**
   * 处理 URL 变化
   * 使用防抖避免频繁触发
   */
  private handleUrlChange(): void {
    // 清除之前的定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的防抖定时器
    this.debounceTimer = window.setTimeout(() => {
      const currentUrl = location.href;

      // 如果 URL 确实发生了变化
      if (currentUrl !== this.lastUrl) {
        console.log(`[PageObserver] URL 变化: ${this.lastUrl} -> ${currentUrl}`);
        this.lastUrl = currentUrl;

        // 通知所有注册的回调
        this.notifyCallbacks(currentUrl);
      }

      this.debounceTimer = null;
    }, this.debounceMs);
  }

  /**
   * 通知所有回调
   * @param url 新的 URL
   */
  private notifyCallbacks(url: string): void {
    for (const callback of this.callbacks) {
      try {
        callback(url);
      } catch (error) {
        console.error('[PageObserver] 回调执行失败:', error);
      }
    }
  }
}

/**
 * 默认页面观察器实例
 */
export const pageObserver = new PageObserver();

/**
 * 获取当前页面的匹配上下文
 * 提取页面信息用于外链匹配
 * @returns 匹配上下文
 */
export function getCurrentMatchContext(): {
  currentUrl: string;
  currentDomain: string;
  currentPath: string;
  pageTitle: string;
  pageKeywords: string[];
  formDetected: boolean;
} {
  const url = new URL(location.href);

  return {
    currentUrl: location.href,
    currentDomain: url.hostname,
    currentPath: url.pathname,
    pageTitle: document.title || '',
    pageKeywords: extractPageKeywords(),
    formDetected: detectFormOnPage(),
  };
}

/**
 * 提取页面关键词
 * 从 meta 标签、标题和内容中提取关键词
 * @returns 关键词列表
 */
function extractPageKeywords(): string[] {
  const keywords: string[] = [];

  // 从 meta keywords 提取
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) {
    const content = metaKeywords.getAttribute('content');
    if (content) {
      keywords.push(...content.split(',').map(k => k.trim()).filter(k => k));
    }
  }

  // 从标题提取关键词（简单分词）
  const title = document.title;
  if (title) {
    const titleWords = title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
    keywords.push(...titleWords);
  }

  // 从 h1 标签提取
  const h1Elements = document.querySelectorAll('h1');
  h1Elements.forEach(h1 => {
    const text = h1.textContent?.trim();
    if (text) {
      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
      keywords.push(...words);
    }
  });

  // 去重
  return [...new Set(keywords)];
}

/**
 * 检测页面是否包含表单
 * @returns 是否检测到表单
 */
function detectFormOnPage(): boolean {
  // 检查是否存在 form 元素
  const forms = document.querySelectorAll('form');
  if (forms.length > 0) {
    return true;
  }

  // 检查是否存在常见的表单输入元素
  const formElements = document.querySelectorAll(
    'input[type="text"], input[type="email"], textarea, input[name*="comment"], input[name*="message"]',
  );
  if (formElements.length >= 2) {
    return true;
  }

  // 检查是否存在提交按钮
  const submitButtons = document.querySelectorAll('input[type="submit"], button[type="submit"]');
  if (submitButtons.length > 0) {
    return true;
  }

  return false;
}
