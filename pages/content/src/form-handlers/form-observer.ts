/**
 * 动态表单监听器
 * 使用 MutationObserver 监听 DOM 变化，自动检测新添加的表单和字段
 *
 * @author yiangto
 * @date 2026-03-13
 */

import { logger } from '@extension/shared';
import { performanceMonitor, MetricType } from '../utils/performance-monitor';

/** 表单变化回调函数 */
export type FormChangeCallback = (addedForms: HTMLFormElement[], addedFields: HTMLElement[]) => void;

/** 监听器配置 */
interface ObserverConfig {
  /** 防抖延迟（毫秒） */
  debounceDelay?: number;
  /** 是否监听属性变化 */
  watchAttributes?: boolean;
  /** 是否监听子树变化 */
  watchSubtree?: boolean;
  /** 目标选择器（限制监听范围） */
  targetSelector?: string;
}

/**
 * 表单监听器类
 */
export class FormObserver {
  /** MutationObserver 实例 */
  private observer: MutationObserver | null = null;

  /** 防抖定时器 */
  private debounceTimer: number | null = null;

  /** 变化回调函数 */
  private callback: FormChangeCallback | null = null;

  /** 配置 */
  private config: Required<ObserverConfig>;

  /** 是否正在运行 */
  private running = false;

  /** 待处理的变化队列 */
  private pendingMutations: MutationRecord[] = [];

  constructor(config?: ObserverConfig) {
    this.config = {
      debounceDelay: 500,
      watchAttributes: true,
      watchSubtree: true,
      targetSelector: 'body',
      ...config,
    };

    logger.debug('FormObserver 已创建', { config: this.config });
  }

  /**
   * 启动监听
   */
  start(callback: FormChangeCallback): void {
    if (this.running) {
      logger.warn('FormObserver 已在运行中');
      return;
    }

    this.callback = callback;
    this.running = true;

    // 创建 MutationObserver
    this.observer = new MutationObserver(mutations => {
      this.handleMutations(mutations);
    });

    // 获取监听目标
    const target = document.querySelector(this.config.targetSelector);
    if (!target) {
      logger.error(`监听目标不存在: ${this.config.targetSelector}`);
      return;
    }

    // 开始监听
    this.observer.observe(target, {
      childList: true,
      subtree: this.config.watchSubtree,
      attributes: this.config.watchAttributes,
      attributeFilter: this.config.watchAttributes
        ? ['type', 'name', 'id', 'class', 'placeholder', 'required']
        : undefined,
    });

    logger.info('FormObserver 已启动', { target: this.config.targetSelector });
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    // 断开 MutationObserver
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // 清除防抖定时器
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // 清空待处理队列
    this.pendingMutations = [];

    logger.info('FormObserver 已停止');
  }

  /**
   * 销毁监听器
   */
  destroy(): void {
    this.stop();
    this.callback = null;
    logger.info('FormObserver 已销毁');
  }

  /**
   * 处理 DOM 变化
   */
  private handleMutations(mutations: MutationRecord[]): void {
    // 将变化添加到待处理队列
    this.pendingMutations.push(...mutations);

    // 清除之前的防抖定时器
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的防抖定时器
    this.debounceTimer = window.setTimeout(() => {
      this.processPendingMutations();
    }, this.config.debounceDelay);
  }

  /**
   * 处理待处理的变化
   */
  private processPendingMutations(): void {
    if (this.pendingMutations.length === 0) {
      return;
    }

    const metricId = performanceMonitor.start(MetricType.FORM_DETECTION, undefined, {
      mutationCount: this.pendingMutations.length,
    });

    // 立即清空队列，防止异常时未清理
    const mutations = [...this.pendingMutations];
    this.pendingMutations = [];

    try {
      // 收集新增的表单和字段
      const addedForms = new Set<HTMLFormElement>();
      const addedFields = new Set<HTMLElement>();

      for (const mutation of mutations) {
        // 处理新增节点
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          this.processAddedNodes(mutation.addedNodes, addedForms, addedFields);
        }

        // 处理属性变化
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          this.processAttributeChange(mutation.target, addedFields);
        }
      }

      // 如果有新增的表单或字段，触发回调
      if ((addedForms.size > 0 || addedFields.size > 0) && this.callback) {
        logger.info('检测到表单变化', {
          forms: addedForms.size,
          fields: addedFields.size,
        });

        this.callback(Array.from(addedForms), Array.from(addedFields));
      }
    } catch (error) {
      logger.error('处理 DOM 变化时出错', error as Error);
    } finally {
      performanceMonitor.end(metricId);
    }
  }

  /**
   * 处理新增节点
   */
  private processAddedNodes(
    nodes: NodeList,
    addedForms: Set<HTMLFormElement>,
    addedFields: Set<HTMLElement>,
  ): void {
    for (const node of Array.from(nodes)) {
      if (!(node instanceof HTMLElement)) {
        continue;
      }

      // 检查是否为表单
      if (node.tagName === 'FORM') {
        addedForms.add(node as HTMLFormElement);
      }

      // 检查是否为表单字段
      if (this.isFormField(node)) {
        addedFields.add(node);
      }

      // 递归检查子节点
      const childForms = node.querySelectorAll('form');
      for (const form of Array.from(childForms)) {
        addedForms.add(form as HTMLFormElement);
      }

      const childFields = node.querySelectorAll(
        'input:not([type="hidden"]):not([type="password"]):not([type="file"]), textarea, select',
      );
      for (const field of Array.from(childFields)) {
        if (this.isFormField(field as HTMLElement)) {
          addedFields.add(field as HTMLElement);
        }
      }
    }
  }

  /**
   * 处理属性变化
   */
  private processAttributeChange(element: HTMLElement, addedFields: Set<HTMLElement>): void {
    // 如果元素变为可见或变为表单字段，添加到字段集合
    if (this.isFormField(element) && this.isVisible(element)) {
      addedFields.add(element);
    }
  }

  /**
   * 检查是否为表单字段
   */
  private isFormField(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'textarea' || tagName === 'select') {
      return true;
    }

    if (tagName === 'input') {
      const type = element.getAttribute('type')?.toLowerCase() || 'text';
      // 排除隐藏字段、密码字段和文件字段
      return type !== 'hidden' && type !== 'password' && type !== 'file';
    }

    return false;
  }

  /**
   * 检查元素是否可见
   */
  private isVisible(element: HTMLElement): boolean {
    // 快速检查
    if (!element.offsetParent && element.tagName !== 'BODY') {
      return false;
    }

    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  }

  /**
   * 获取运行状态
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ObserverConfig>): void {
    const wasRunning = this.running;
    const oldCallback = this.callback;

    // 如果正在运行，先停止
    if (wasRunning) {
      this.stop();
    }

    // 更新配置
    this.config = { ...this.config, ...config };

    logger.debug('FormObserver 配置已更新', { config: this.config });

    // 如果之前在运行，重新启动
    if (wasRunning && oldCallback) {
      this.start(oldCallback);
    }
  }
}
