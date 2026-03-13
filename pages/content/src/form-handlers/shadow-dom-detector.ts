/**
 * Shadow DOM 检测器
 * 递归遍历 Shadow DOM 树，查找表单字段
 *
 * @author yiangto
 * @date 2026-03-13
 */

import { FieldAnalyzer } from './field-analyzer';
import type { DetectedField, FormFieldElement } from '../types/field-analyzer';

/**
 * Shadow DOM 检测配置
 */
interface ShadowDOMConfig {
  /** 最大递归深度，防止无限递归 */
  maxDepth: number;
  /** 是否包含已检测的元素 */
  includeDuplicates: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ShadowDOMConfig = {
  maxDepth: 10,
  includeDuplicates: false,
};

/**
 * Shadow DOM 检测器类
 */
export class ShadowDOMDetector {
  /** 字段分析器实例 */
  private fieldAnalyzer: FieldAnalyzer;

  /** 已检测的元素集合，用于去重 */
  private detectedElements = new WeakSet<Element>();

  /** 检测到的字段列表 */
  private shadowRootFields: DetectedField[] = [];

  constructor(fieldAnalyzer: FieldAnalyzer) {
    this.fieldAnalyzer = fieldAnalyzer;
  }

  /**
   * 检测 Shadow DOM 中的表单字段
   * 从根节点开始递归遍历所有 Shadow Root
   *
   * @param root - 根节点，默认为 document.body
   * @param config - 检测配置
   * @returns 检测到的字段列表
   */
  detectShadowDOMFields(
    root: Node = document.body,
    config: Partial<ShadowDOMConfig> = {},
  ): DetectedField[] {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // 重置状态
    this.shadowRootFields = [];
    if (!finalConfig.includeDuplicates) {
      this.detectedElements = new WeakSet();
    }

    // 开始遍历
    this.traverseNode(root, 0, finalConfig.maxDepth);

    return this.shadowRootFields;
  }

  /**
   * 递归遍历节点，查找 Shadow Root
   *
   * @param node - 当前节点
   * @param currentDepth - 当前深度
   * @param maxDepth - 最大深度
   */
  private traverseNode(node: Node, currentDepth: number, maxDepth: number): void {
    // 深度限制
    if (currentDepth >= maxDepth) {
      return;
    }

    // 检查是否为元素节点
    if (!(node instanceof Element)) {
      return;
    }

    // 如果元素有 Shadow Root，遍历它
    if (node.shadowRoot) {
      this.traverseShadowRoot(node.shadowRoot, currentDepth + 1, maxDepth);
    }

    // 遍历子节点
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      this.traverseNode(children[i], currentDepth, maxDepth);
    }
  }

  /**
   * 遍历 Shadow Root 内部的元素
   *
   * @param shadowRoot - Shadow Root 节点
   * @param currentDepth - 当前深度
   * @param maxDepth - 最大深度
   */
  private traverseShadowRoot(shadowRoot: ShadowRoot, currentDepth: number, maxDepth: number): void {
    // 深度限制
    if (currentDepth >= maxDepth) {
      return;
    }

    // 使用 TreeWalker 遍历 Shadow Root 中的所有元素
    const walker = document.createTreeWalker(shadowRoot, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const element = node as Element;

        // 递归处理嵌套的 Shadow Root
        if (element.shadowRoot) {
          this.traverseShadowRoot(element.shadowRoot, currentDepth + 1, maxDepth);
        }

        // 检查是否为表单字段
        return this.isFieldElement(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    // 遍历所有匹配的节点
    let node: Node | null = walker.nextNode();
    while (node) {
      const element = node as FormFieldElement;

      // 验证字段并添加到结果
      if (this.isValidField(element) && !this.detectedElements.has(element)) {
        this.detectedElements.add(element);
        const detectedField = this.createDetectedField(element);
        this.shadowRootFields.push(detectedField);
      }

      node = walker.nextNode();
    }
  }

  /**
   * 检查节点是否为表单字段元素
   *
   * @param node - DOM 节点
   * @returns 是否为表单字段
   */
  private isFieldElement(node: Node): boolean {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    const tagName = node.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  }

  /**
   * 验证字段是否有效
   * 过滤掉隐藏字段、按钮等无效字段
   * 特殊处理：保留 React Select 等组件使用的隐藏字段
   *
   * @param element - 表单元素
   * @returns 是否有效
   */
  private isValidField(element: HTMLElement): boolean {
    // 过滤被标记为忽略的字段
    if (element.hasAttribute('data-bwignore') || element.hasAttribute('data-lpignore')) {
      return false;
    }

    // 过滤按钮
    if (element instanceof HTMLButtonElement) {
      return false;
    }

    // 特殊处理 hidden 字段
    if (element instanceof HTMLInputElement && element.type === 'hidden') {
      // 检查是否为 React Select 等组件的隐藏字段
      const container = element.closest('[class*="select"]') || element.closest('[class*="Select"]');
      if (container) {
        // 保留 React Select 的隐藏字段
        return true;
      }
      // 其他隐藏字段过滤掉
      return false;
    }

    // 过滤不可见的字段（除了 hidden 类型）
    if (element.offsetParent === null && element.getAttribute('type') !== 'hidden') {
      return false;
    }

    // 过滤特定类型的 input
    if (element instanceof HTMLInputElement) {
      const ignoredTypes = new Set([
        'submit',
        'button',
        'reset',
        'image',
        'file',
        'password', // link-pilot 不处理密码字段
      ]);

      if (ignoredTypes.has(element.type)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 创建检测到的字段对象
   *
   * @param element - 表单元素
   * @returns 检测到的字段
   */
  private createDetectedField(element: FormFieldElement): DetectedField {
    const detectedField: DetectedField = {
      element,
      metadata: {} as any, // 临时占位
    };

    // 使用 FieldAnalyzer 分析字段
    const metadata = this.fieldAnalyzer.analyzeField(detectedField);
    detectedField.metadata = metadata;

    return detectedField;
  }

  /**
   * 清空检测状态
   */
  clear(): void {
    this.shadowRootFields = [];
    this.detectedElements = new WeakSet();
  }
}
