/**
 * 悬浮球控制器
 * 负责生命周期管理、Shadow DOM 创建、与页面通信
 */

import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import type {
  FormDetectionResult,
  FormDetector,
} from '../form-handlers/form-detector';
import type {
  WebsiteProfile,
  ManagedBacklink,
} from '@extension/shared';

/**
 * 悬浮球状态
 */
export enum FloatingBallState {
  HIDDEN = 'hidden',
  COLLAPSED = 'collapsed',
  DETECTED_BREATH = 'detected_breath',
  DETECTED_SUBTLE = 'detected_subtle',
  EXPANDED = 'expanded',
  FILLING = 'filling',
  SUCCESS = 'success',
  ERROR = 'error',
}

/**
 * 消息类型
 */
export const MessageTypes = {
  OPEN_FLOATING_PANEL: 'OPEN_FLOATING_PANEL',
  CLOSE_FLOATING_PANEL: 'CLOSE_FLOATING_PANEL',
  TRIGGER_FILL: 'TRIGGER_FILL',
  FILL_SUCCESS: 'FILL_SUCCESS',
  FILL_ERROR: 'FILL_ERROR',
  FORM_DETECTED: 'FORM_DETECTED',
  BACKLINK_MATCHED: 'BACKLINK_MATCHED',
  UPDATE_PROFILES: 'UPDATE_PROFILES',
} as const;

/**
 * 悬浮球控制器配置
 */
interface FloatingBallControllerConfig {
  /** 表单检测器实例 */
  formDetector: FormDetector;
  /** 自动检测表单 */
  autoDetect: boolean;
  /** 高置信度阈值 */
  highConfidenceThreshold: number;
  /** 低置信度阈值 */
  lowConfidenceThreshold: number;
}

/**
 * 填充数据
 */
interface FillPayload {
  profileId: string;
  backlinkId: string;
  fillMode: 'smart' | 'manual';
  comment?: string;
}

/**
 * 悬浮球控制器
 */
export class FloatingBallController {
  /** Shadow DOM 宿主元素 */
  private host: HTMLElement | null = null;
  /** Shadow Root */
  private shadowRoot: ShadowRoot | null = null;
  /** React Root */
  private reactRoot: ReturnType<typeof createRoot> | null = null;
  /** 当前状态 */
  private state: FloatingBallState = FloatingBallState.HIDDEN;
  /** 检测到的表单 */
  private detectedForm: FormDetectionResult | null = null;
  /** 匹配的外链 */
  private matchedBacklink: ManagedBacklink | null = null;
  /** 匹配置信度 */
  private matchConfidence: number = 0;
  /** 网站资料列表 */
  private profiles: WebsiteProfile[] = [];
  /** 配置 */
  private config: FloatingBallControllerConfig;
  /** 检测间隔 */
  private detectionInterval: number | null = null;
  /** 样式表 */
  private styleSheet: CSSStyleSheet | null = null;

  constructor(config: FloatingBallControllerConfig) {
    this.config = config;
  }

  /**
   * 初始化悬浮球
   */
  async initialize(): Promise<void> {
    // 检查是否已存在
    if (this.host) {
      console.log('[FloatingBall] Already initialized');
      return;
    }

    // 创建 Shadow DOM
    this.createShadowDOM();

    // 加载数据
    await this.loadData();

    // 开始表单检测
    if (this.config.autoDetect) {
      this.startFormDetection();
    }

    // 设置消息监听
    this.setupMessageListener();

    // 初始状态：收起
    this.setState(FloatingBallState.COLLAPSED);

    console.log('[FloatingBall] Controller initialized');
  }

  /**
   * 创建 Shadow DOM
   */
  private createShadowDOM(): void {
    // 创建宿主元素
    this.host = document.createElement('div');
    this.host.id = 'link-pilot-floating-ball-host';

    // 设置宿主样式
    Object.assign(this.host.style, {
      position: 'fixed',
      bottom: '0',
      right: '0',
      width: '0',
      height: '0',
      overflow: 'visible',
      zIndex: '2147483647',
      pointerEvents: 'none',
    });

    document.body.appendChild(this.host);

    // 创建 Shadow Root
    this.shadowRoot = this.host.attachShadow({ mode: 'open' });

    // 创建内容容器
    const container = document.createElement('div');
    container.id = 'link-pilot-floating-ball-container';
    container.style.pointerEvents = 'auto';
    this.shadowRoot.appendChild(container);

    // 注入样式
    this.injectStyles();

    // 创建 React Root
    this.reactRoot = createRoot(container);
  }

  /**
   * 注入 Tailwind 样式
   */
  private injectStyles(): void {
    if (!this.shadowRoot) return;

    // 获取 content-ui 构建的 CSS
    // 由于是在 content script 中，我们需要手动注入样式
    const styleId = 'link-pilot-floating-ball-styles';

    // 检查是否已存在
    if (this.shadowRoot.getElementById(styleId)) return;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;

    // 基础 Tailwind-like 样式
    styleEl.textContent = `
      /* Reset */
      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      /* Layout */
      .fixed { position: fixed; }
      .absolute { position: absolute; }
      .relative { position: relative; }
      .inset-0 { inset: 0; }
      .bottom-4 { bottom: 1rem; }
      .right-4 { right: 1rem; }
      .z-50 { z-index: 50; }
      .z-\[2147483647\] { z-index: 2147483647; }

      /* Flex */
      .flex { display: flex; }
      .inline-flex { display: inline-flex; }
      .flex-1 { flex: 1 1 0%; }
      .items-center { align-items: center; }
      .justify-center { justify-content: center; }
      .justify-between { justify-content: space-between; }
      .justify-end { justify-content: flex-end; }
      .gap-1 { gap: 0.25rem; }
      .gap-1\.5 { gap: 0.375rem; }
      .gap-2 { gap: 0.5rem; }

      /* Display */
      .block { display: block; }
      .inline-block { display: inline-block; }
      .hidden { display: none; }

      /* Sizing */
      .h-3 { height: 0.75rem; }
      .h-4 { height: 1rem; }
      .h-5 { height: 1.25rem; }
      .h-6 { height: 1.5rem; }
      .h-8 { height: 2rem; }
      .h-14 { height: 3.5rem; }
      .w-3 { width: 0.75rem; }
      .w-4 { width: 1rem; }
      .w-5 { width: 1.25rem; }
      .w-6 { width: 1.5rem; }
      .w-8 { width: 2rem; }
      .w-14 { width: 3.5rem; }
      .w-80 { width: 20rem; }
      .w-full { width: 100%; }
      .max-w-sm { max-width: 24rem; }
      .min-w-\[320px\] { min-width: 320px; }

      /* Spacing */
      .m-0 { margin: 0; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      .mb-1 { margin-bottom: 0.25rem; }
      .mb-3 { margin-bottom: 0.75rem; }
      .mr-1 { margin-right: 0.25rem; }
      .ml-2 { margin-left: 0.5rem; }
      .mt-1 { margin-top: 0.25rem; }
      .mt-4 { margin-top: 1rem; }
      .p-0 { padding: 0; }
      .p-3 { padding: 0.75rem; }
      .p-4 { padding: 1rem; }
      .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
      .px-2\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
      .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
      .px-4 { padding-left: 1rem; padding-right: 1rem; }
      .py-0\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
      .py-1\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
      .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      .py-2\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .pr-8 { padding-right: 2rem; }

      /* Typography */
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-base { font-size: 1rem; line-height: 1.5rem; }
      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      .font-medium { font-weight: 500; }
      .font-semibold { font-weight: 600; }
      .text-gray-400 { color: #9ca3af; }
      .text-gray-500 { color: #6b7280; }
      .text-gray-600 { color: #4b5563; }
      .text-gray-800 { color: #1f2937; }
      .text-gray-900 { color: #111827; }
      .text-blue-500 { color: #3b82f6; }
      .text-blue-600 { color: #2563eb; }
      .text-blue-700 { color: #1d4ed8; }
      .text-blue-800 { color: #1e40af; }
      .text-green-800 { color: #166534; }
      .text-red-800 { color: #991b1b; }
      .text-yellow-800 { color: #854d0e; }
      .text-white { color: #ffffff; }

      /* Background */
      .bg-white { background-color: #ffffff; }
      .bg-gray-50 { background-color: #f9fafb; }
      .bg-gray-100 { background-color: #f3f4f6; }
      .bg-blue-50 { background-color: #eff6ff; }
      .bg-blue-100 { background-color: #dbeafe; }
      .bg-blue-500 { background-color: #3b82f6; }
      .bg-green-100 { background-color: #dcfce7; }
      .bg-red-100 { background-color: #fee2e2; }
      .bg-yellow-100 { background-color: #fef9c3; }
      .bg-black\/30 { background-color: rgba(0, 0, 0, 0.3); }
      .bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
      .bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
      .from-blue-500 { --tw-gradient-from: #3b82f6; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
      .from-blue-600 { --tw-gradient-from: #2563eb; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
      .from-gray-600 { --tw-gradient-from: #4b5563; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
      .to-blue-600 { --tw-gradient-to: #2563eb; }
      .to-blue-700 { --tw-gradient-to: #1d4ed8; }
      .to-gray-700 { --tw-gradient-to: #374151; }

      /* Borders */
      .border { border-width: 1px; }
      .border-b { border-bottom-width: 1px; }
      .border-dashed { border-style: dashed; }
      .border-gray-100 { border-color: #f3f4f6; }
      .border-gray-200 { border-color: #e5e7eb; }
      .border-gray-300 { border-color: #d1d5db; }
      .border-blue-500 { border-color: #3b82f6; }
      .border-transparent { border-color: transparent; }
      .rounded-lg { border-radius: 0.5rem; }
      .rounded-xl { border-radius: 0.75rem; }
      .rounded-2xl { border-radius: 1rem; }
      .rounded-full { border-radius: 9999px; }

      /* Shadows */
      .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
      .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); }
      .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); }
      .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
      .shadow-blue-500\/20 { box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.2); }
      .shadow-blue-500\/30 { box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3); }
      .ring-1 { box-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color); }
      .ring-black\/5 { --tw-ring-color: rgba(0, 0, 0, 0.05); }

      /* Effects */
      .opacity-25 { opacity: 0.25; }
      .opacity-75 { opacity: 0.75; }
      .pointer-events-none { pointer-events: none; }
      .pointer-events-auto { pointer-events: auto; }
      .cursor-pointer { cursor: pointer; }
      .cursor-not-allowed { cursor: not-allowed; }

      /* Transitions */
      .transition-all { transition-property: all; }
      .transition-colors { transition-property: background-color, border-color, color, fill, stroke; }
      .duration-200 { transition-duration: 200ms; }
      .ease-in-out { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }

      /* Transform */
      .scale-95 { transform: scale(0.95); }
      .scale-110 { transform: scale(1.1); }
      .translate-y-\[-50\%\] { transform: translateY(-50%); }

      /* Animation */
      .animate-spin { animation: spin 1s linear infinite; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      /* Focus */
      .focus\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
      .focus\:border-blue-500:focus { border-color: #3b82f6; }
      .focus\:ring-2:focus { box-shadow: 0 0 0 2px var(--tw-ring-color); }
      .focus\:ring-blue-500\/20:focus { --tw-ring-color: rgba(59, 130, 246, 0.2); }

      /* Hover */
      .hover\:scale-110:hover { transform: scale(1.1); }
      .hover\:from-blue-600:hover { --tw-gradient-from: #2563eb; }
      .hover\:to-blue-700:hover { --tw-gradient-to: #1d4ed8; }
      .hover\:border-gray-300:hover { border-color: #d1d5db; }
      .hover\:bg-gray-100:hover { background-color: #f3f4f6; }
      .hover\:bg-blue-600:hover { background-color: #2563eb; }
      .hover\:text-gray-600:hover { color: #4b5563; }
      .hover\:text-blue-700:hover { color: #1d4ed8; }
      .hover\:shadow-md:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); }

      /* Active */
      .active\:scale-95:active { transform: scale(0.95); }

      /* Disabled */
      .disabled\:opacity-50:disabled { opacity: 0.5; }
      .disabled\:shadow-none:disabled { box-shadow: none; }

      /* Appearance */
      .appearance-none { appearance: none; }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;

    this.shadowRoot.appendChild(styleEl);
  }

  /**
   * 加载数据
   */
  private async loadData(): Promise<void> {
    try {
      // 从 storage 加载网站资料
      const response = await chrome.runtime.sendMessage({
        type: 'GET_WEBSITE_PROFILES',
      });

      if (response?.success && response.data) {
        this.profiles = response.data;
      }
    } catch (error) {
      console.error('[FloatingBall] Failed to load profiles:', error);
    }
  }

  /**
   * 开始表单检测
   */
  private startFormDetection(): void {
    // 立即检测一次
    this.detectForm();

    // 设置定时检测
    this.detectionInterval = window.setInterval(() => {
      this.detectForm();
    }, 2000);
  }

  /**
   * 检测表单
   */
  private async detectForm(): Promise<void> {
    try {
      const result = await this.config.formDetector.detect();
      this.detectedForm = result;

      if (result.detected) {
        // 根据置信度决定状态
        if (result.confidence >= this.config.highConfidenceThreshold) {
          this.setState(FloatingBallState.DETECTED_BREATH);
        } else if (result.confidence >= this.config.lowConfidenceThreshold) {
          this.setState(FloatingBallState.DETECTED_SUBTLE);
        }

        // 发送表单检测消息
        this.broadcastMessage({
          type: MessageTypes.FORM_DETECTED,
          payload: { detected: true, confidence: result.confidence },
        });
      }
    } catch (error) {
      console.error('[FloatingBall] Form detection error:', error);
    }
  }

  /**
   * 设置消息监听
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 保持消息通道开放
    });
  }

  /**
   * 处理消息
   */
  private handleMessage(
    message: { type: string; payload?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): void {
    switch (message.type) {
      case MessageTypes.OPEN_FLOATING_PANEL:
        this.setState(FloatingBallState.EXPANDED);
        sendResponse({ success: true });
        break;

      case MessageTypes.CLOSE_FLOATING_PANEL:
        this.setState(FloatingBallState.COLLAPSED);
        sendResponse({ success: true });
        break;

      case MessageTypes.TRIGGER_FILL:
        this.handleFill(message.payload as FillPayload);
        sendResponse({ success: true });
        break;

      case MessageTypes.UPDATE_PROFILES:
        this.loadData();
        sendResponse({ success: true });
        break;

      default:
        break;
    }
  }

  /**
   * 处理填充请求
   */
  private async handleFill(payload: FillPayload): Promise<void> {
    this.setState(FloatingBallState.FILLING);

    try {
      // 发送填充消息到 content script
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_FILL',
        payload: {
          form: this.detectedForm,
          profileId: payload.profileId,
          backlinkId: payload.backlinkId,
          fillMode: payload.fillMode,
          comment: payload.comment,
        },
      });

      if (response?.success) {
        this.setState(FloatingBallState.SUCCESS);
        this.broadcastMessage({ type: MessageTypes.FILL_SUCCESS, payload: response });
      } else {
        this.setState(FloatingBallState.ERROR);
        this.broadcastMessage({ type: MessageTypes.FILL_ERROR, payload: response });
      }
    } catch (error) {
      console.error('[FloatingBall] Fill error:', error);
      this.setState(FloatingBallState.ERROR);
      this.broadcastMessage({
        type: MessageTypes.FILL_ERROR,
        payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  /**
   * 广播消息
   */
  private broadcastMessage(message: { type: string; payload?: unknown }): void {
    // 发送给 background script
    chrome.runtime.sendMessage(message).catch(() => {
      // 忽略发送失败
    });
  }

  /**
   * 设置状态
   */
  private setState(newState: FloatingBallState): void {
    if (this.state === newState) return;

    this.state = newState;
    this.render();
  }

  /**
   * 渲染组件
   */
  private render(): void {
    if (!this.reactRoot) return;

    // 这里我们通过 window 对象与 React 组件通信
    // 实际的组件渲染由 content-ui 处理
    window.dispatchEvent(
      new CustomEvent('LINK_PILOT_FLOATING_BALL_STATE', {
        detail: {
          state: this.state,
          profiles: this.profiles,
          detectedForm: this.detectedForm,
          matchedBacklink: this.matchedBacklink,
          matchConfidence: this.matchConfidence,
          currentUrl: window.location.href,
        },
      })
    );
  }

  /**
   * 显示悬浮球
   */
  show(): void {
    this.setState(FloatingBallState.COLLAPSED);
  }

  /**
   * 隐藏悬浮球
   */
  hide(): void {
    this.setState(FloatingBallState.HIDDEN);
  }

  /**
   * 展开面板
   */
  expand(): void {
    this.setState(FloatingBallState.EXPANDED);
  }

  /**
   * 收起面板
   */
  collapse(): void {
    this.setState(FloatingBallState.COLLAPSED);
  }

  /**
   * 更新匹配的外链
   */
  setMatchedBacklink(backlink: ManagedBacklink | null, confidence: number): void {
    this.matchedBacklink = backlink;
    this.matchConfidence = confidence;

    window.dispatchEvent(
      new CustomEvent('LINK_PILOT_BACKLINK_MATCHED', {
        detail: { backlink, confidence },
      })
    );
  }

  /**
   * 销毁悬浮球
   */
  destroy(): void {
    // 清除定时器
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    // 卸载 React
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }

    // 移除宿主元素
    if (this.host) {
      this.host.remove();
      this.host = null;
    }

    this.shadowRoot = null;
    this.state = FloatingBallState.HIDDEN;

    console.log('[FloatingBall] Controller destroyed');
  }
}

/**
 * 创建悬浮球控制器实例
 */
export function createFloatingBallController(
  config: FloatingBallControllerConfig
): FloatingBallController {
  return new FloatingBallController(config);
}
