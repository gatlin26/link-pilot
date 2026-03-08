/**
 * 浮动采集按钮
 * 在页面右侧显示采集按钮
 */

class FloatingCollector {
  private button: HTMLDivElement | null = null;
  private currentDomain: string = '';
  private isCollected: boolean = false;
  private isContextValid: boolean = true;

  constructor() {
    // 延迟初始化，等待 background script 准备好
    setTimeout(() => {
      this.init().catch(error => {
        console.error('[Floating Collector] 初始化失败:', error);
      });
    }, 2000);
  }

  private async init() {
    // 检查 extension context 是否有效
    if (!this.checkContextValid()) {
      console.log('[Floating Collector] Extension context 无效，停止初始化');
      return;
    }

    // 先检查 background script 是否准备好
    const isReady = await this.waitForBackgroundReady();
    if (!isReady) {
      console.log('[Floating Collector] Background script 未准备好，停止初始化');
      return;
    }

    // 获取当前域名
    this.currentDomain = this.extractDomain(window.location.href);

    // 检查是否已采集
    await this.checkIfCollected();

    // 如果未采集且 context 仍然有效，显示按钮
    if (!this.isCollected && this.isContextValid) {
      this.createButton();
    }
  }

  /**
   * 检查 extension context 是否有效
   */
  private checkContextValid(): boolean {
    try {
      // 检查 chrome.runtime.id 是否存在
      if (!chrome.runtime?.id) {
        this.isContextValid = false;
        return false;
      }
      return true;
    } catch (error) {
      this.isContextValid = false;
      return false;
    }
  }

  /**
   * 等待 background script 准备好
   */
  private async waitForBackgroundReady(maxAttempts: number = 3): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // 检查 extension context 是否有效
        if (!this.checkContextValid()) {
          console.log('[Floating Collector] Extension context 无效，停止等待');
          return false;
        }

        // 发送 ping 消息测试连接
        await chrome.runtime.sendMessage({ type: 'PING' });
        console.log('[Floating Collector] Background script 已准备好');
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // 如果是 context invalidated 错误，直接返回 false
        if (errorMessage.includes('Extension context invalidated')) {
          console.log('[Floating Collector] Extension context 已失效，停止等待');
          this.isContextValid = false;
          return false;
        }

        console.log(`[Floating Collector] 等待 background script (${i + 1}/${maxAttempts})...`);
        if (i < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    return false;
  }

  /**
   * 提取域名
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  /**
   * 检查是否已采集
   */
  private async checkIfCollected() {
    try {
      // 检查 context 是否有效
      if (!this.checkContextValid()) {
        console.log('[Floating Collector] Extension context 无效，跳过检查');
        return;
      }

      console.log('[Floating Collector] 检查域名是否已采集:', this.currentDomain);

      // 发送消息到 background 检查是否已采集
      const response = await this.sendMessageWithRetry({
        type: 'CHECK_IF_COLLECTED',
        payload: { domain: this.currentDomain },
      }, 2);

      this.isCollected = response?.isCollected || false;
      console.log('[Floating Collector] 检查结果:', this.isCollected ? '已采集' : '未采集');
    } catch (error) {
      console.error('[Floating Collector] 检查采集状态失败:', error);
      // 如果检查失败，默认不显示按钮（保守策略）
      this.isCollected = true;
    }
  }

  /**
   * 发送消息并重试
   */
  private async sendMessageWithRetry(message: any, maxRetries: number = 2): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // 检查 extension context 是否有效
        if (!this.checkContextValid()) {
          throw new Error('Extension context invalidated');
        }

        const response = await chrome.runtime.sendMessage(message);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // 如果是 context invalidated 错误，不再重试
        if (errorMessage.includes('Extension context invalidated')) {
          console.log('[Floating Collector] Extension context 已失效');
          this.isContextValid = false;
          throw new Error('扩展已重新加载');
        }

        if (i === maxRetries - 1) {
          throw error;
        }
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  /**
   * 创建浮动按钮
   */
  private createButton() {
    // 创建按钮容器
    this.button = document.createElement('div');
    this.button.id = 'link-pilot-floating-collector';
    this.button.innerHTML = `
      <style>
        #link-pilot-floating-collector {
          position: fixed;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        #link-pilot-collector-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px 20px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          transition: all 0.3s ease;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          min-width: 120px;
        }

        #link-pilot-collector-btn:hover {
          transform: translateX(-5px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }

        #link-pilot-collector-btn:active {
          transform: translateX(-5px) scale(0.98);
        }

        #link-pilot-collector-btn.collecting {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          cursor: not-allowed;
        }

        #link-pilot-collector-btn.success {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }

        .collector-icon {
          font-size: 24px;
        }

        .collector-text {
          font-size: 12px;
          line-height: 1.2;
          text-align: center;
        }

        .collector-count {
          font-size: 10px;
          opacity: 0.9;
        }
      </style>
      <button id="link-pilot-collector-btn">
        <span class="collector-icon">🔗</span>
        <span class="collector-text">采集外链</span>
      </button>
    `;

    // 添加到页面
    document.body.appendChild(this.button);

    // 绑定点击事件
    const btn = this.button.querySelector('#link-pilot-collector-btn') as HTMLButtonElement;
    btn.addEventListener('click', () => this.handleCollect());
  }

  /**
   * 处理采集
   */
  private async handleCollect() {
    const btn = this.button?.querySelector('#link-pilot-collector-btn') as HTMLButtonElement;
    if (!btn) return;

    // 检查 context 是否有效
    if (!this.checkContextValid()) {
      this.showError(btn, '扩展已重新加载，请刷新页面');
      return;
    }

    // 禁用按钮
    btn.classList.add('collecting');
    btn.disabled = true;
    btn.innerHTML = `
      <span class="collector-icon">⏳</span>
      <span class="collector-text">采集中...</span>
    `;

    try {
      // 发送采集请求到 background
      const response = await this.sendMessageWithRetry({
        type: 'START_MANUAL_COLLECTION',
        payload: { targetUrl: window.location.origin },
      }, 2);

      if (response?.success) {
        // 采集成功
        btn.classList.remove('collecting');
        btn.classList.add('success');
        btn.innerHTML = `
          <span class="collector-icon">✅</span>
          <span class="collector-text">采集成功</span>
          <span class="collector-count">${response.count || 0} 条外链</span>
        `;

        // 3秒后移除按钮
        setTimeout(() => {
          this.removeButton();
        }, 3000);
      } else {
        // 采集失败
        this.showError(btn, response?.error || '未知错误');
      }
    } catch (error) {
      console.error('[Floating Collector] 采集失败:', error);
      const errorMessage = error instanceof Error ? error.message : '连接失败';
      this.showError(btn, errorMessage);
    }
  }

  /**
   * 显示错误信息
   */
  private showError(btn: HTMLButtonElement, errorMessage: string) {
    btn.classList.remove('collecting');
    btn.disabled = false;
    btn.innerHTML = `
      <span class="collector-icon">❌</span>
      <span class="collector-text">采集失败</span>
      <span class="collector-count" style="font-size: 9px;">${errorMessage}</span>
    `;

    // 3秒后恢复按钮
    setTimeout(() => {
      btn.classList.remove('success');
      btn.innerHTML = `
        <span class="collector-icon">🔗</span>
        <span class="collector-text">采集外链</span>
      `;
    }, 3000);
  }

  /**
   * 移除按钮
   */
  private removeButton() {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
  }
}

// 初始化浮动采集器
export function initFloatingCollector() {
  // 排除特殊页面
  const excludedDomains = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'ahrefs.com',
  ];

  const currentUrl = window.location.href;
  const shouldExclude = excludedDomains.some(domain => currentUrl.startsWith(domain));

  if (!shouldExclude) {
    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        new FloatingCollector();
      });
    } else {
      new FloatingCollector();
    }
  }
}
