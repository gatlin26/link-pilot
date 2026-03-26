/**
 * 字段分析器
 * 复用自 superfill.ai，用于智能分析表单字段
 *
 * 核心功能：
 * - 7 种标签来源识别（labelTag, labelAria, labelData, labelLeft, labelTop, placeholder, helperText）
 * - 位置感知的标签检测（TreeWalker + 距离阈值）
 * - 字段质量评分系统
 * - 重复字段过滤
 * - 可见性和交互性检测
 *
 * @author yiangto
 * @date 2026-03-13
 */

import type {
  DetectedField,
  FieldMetadata,
  FieldPurpose,
  FieldType,
  FormFieldElement,
  SelectOption,
} from '../types/field-analyzer';
import { getCachedComputedStyle } from '../utils/dom-cache';
import { FORM_DETECTION_CONFIG } from '../config/constants';
import {
  INTERACTIVE_CURSORS,
  INTERACTIVE_ROLES,
  INTERACTIVE_TAGS,
  FIELD_PURPOSE_PATTERNS,
  AUTOCOMPLETE_MAP,
} from './field-analyzer-constants';

/**
 * 字段分析器类
 */
export class FieldAnalyzer {
  /** 标签缓存，避免重复计算 */
  private labelCache = new WeakMap<Element, string | null>();

  /**
   * 检查元素是否可见
   */
  isElementVisible(element: FormFieldElement): boolean {
    const style = getCachedComputedStyle(element);
    if (!style) return false;

    return (
      element.offsetWidth > 0 &&
      element.offsetHeight > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none'
    );
  }

  /**
   * 检查元素是否在最上层（未被遮挡）
   */
  isTopElement(element: FormFieldElement): boolean {
    const rects = element.getClientRects();
    if (!rects || rects.length === 0) return false;

    const rect = rects[Math.floor(rects.length / 2)];
    if (rect.width === 0 || rect.height === 0) return false;

    // 检查是否在视口内
    const isInViewport = !(
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    );
    if (!isInViewport) return false;

    // 处理 Shadow DOM
    const shadowRoot = element.getRootNode();
    if (shadowRoot instanceof ShadowRoot) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      try {
        const topEl = shadowRoot.elementFromPoint(centerX, centerY);
        if (!topEl) return false;
        if (topEl === element) return true;

        let current: Element | null = topEl;
        while (current) {
          if (current === element) return true;
          current = current.parentElement ?? null;
        }
        return false;
      } catch {
        return true;
      }
    }

    // 检查多个点是否被遮挡
    const margin = 5;
    const checkPoints = [
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      { x: rect.left + margin, y: rect.top + margin },
      { x: rect.right - margin, y: rect.bottom - margin },
    ];

    return checkPoints.some(({ x, y }) => {
      try {
        const topEl = document.elementFromPoint(x, y);
        if (!topEl) return false;

        let current: Element | null = topEl;
        while (current && current !== document.documentElement) {
          if (current === element) return true;
          current = current.parentElement;
        }
        return false;
      } catch {
        return true;
      }
    });
  }

  /**
   * 检查元素是否可交互
   */
  isInteractiveElement(element: FormFieldElement): boolean {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    const tagName = element.tagName.toLowerCase();
    const style = getCachedComputedStyle(element);

    // 检查光标样式
    if (style?.cursor && INTERACTIVE_CURSORS.has(style.cursor)) {
      return true;
    }

    // 检查标签类型
    if (INTERACTIVE_TAGS.has(tagName)) {
      if (
        element.hasAttribute('disabled') ||
        element.hasAttribute('readonly') ||
        (element as HTMLInputElement).disabled ||
        (element as HTMLInputElement).readOnly
      ) {
        return false;
      }
      return true;
    }

    // 检查 ARIA 角色
    const role = element.getAttribute('role');
    if (role && INTERACTIVE_ROLES.has(role)) return true;

    // 检查 contenteditable
    if (
      element.getAttribute('contenteditable') === 'true' ||
      (element as HTMLElement).isContentEditable
    ) {
      return true;
    }

    // 检查 onclick 事件
    if (
      element.hasAttribute('onclick') ||
      typeof (element as HTMLElement).onclick === 'function'
    ) {
      return true;
    }

    // 检查 tabindex
    if (
      element.hasAttribute('tabindex') &&
      element.getAttribute('tabindex') !== '-1'
    ) {
      return true;
    }

    return false;
  }

  /**
   * 分析字段
   * 提取所有元数据并推断字段用途
   */
  analyzeField(field: DetectedField): FieldMetadata {
    const element = field.element;

    const basicAttrs = this.extractBasicAttributes(element);
    const labels = this.extractLabels(element);
    const fieldType = this.classifyFieldType(element);

    const isVisible = this.isElementVisible(element);
    const isTopEl = isVisible ? this.isTopElement(element) : false;
    const isInteractive = this.isInteractiveElement(element);

    const metadata: Omit<FieldMetadata, 'fieldPurpose'> = {
      ...basicAttrs,
      ...labels,
      fieldType,
      rect: element.getBoundingClientRect(),
      currentValue: this.getCurrentValue(element),
      isVisible,
      isTopElement: isTopEl,
      isInteractive,
    };

    return {
      ...metadata,
      fieldPurpose: this.inferFieldPurpose(metadata, fieldType),
    };
  }

  /**
   * 提取基本属性
   */
  private extractBasicAttributes(element: FormFieldElement) {
    return {
      id: element.getAttribute('id') || null,
      name: element.getAttribute('name') || null,
      className: element.getAttribute('class') || null,
      type: element.getAttribute('type') || element.tagName.toLowerCase(),
      placeholder: element.getAttribute('placeholder') || null,
      autocomplete: element.getAttribute('autocomplete') || null,
      required: element.hasAttribute('required'),
      disabled: element.hasAttribute('disabled'),
      readonly: element.hasAttribute('readonly'),
      maxLength:
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
          ? element.maxLength > 0
            ? element.maxLength
            : null
          : null,
    };
  }

  /**
   * 提取标签（7 种来源）
   */
  private extractLabels(element: FormFieldElement) {
    return {
      labelTag: this.findExplicitLabel(element),
      labelData: element.getAttribute('data-label') || null,
      labelAria: this.findAriaLabel(element),
      labelLeft: this.findPositionalLabel(element, 'left'),
      labelTop: this.findPositionalLabel(element, 'top'),
      helperText: this.findHelperText(element),
    };
  }

  /**
   * 查找显式 label 标签
   */
  private findExplicitLabel(element: FormFieldElement): string | null {
    // 通过 for 属性关联
    if (element.id) {
      const label = document.querySelector<HTMLLabelElement>(
        `label[for="${element.id}"]`,
      );
      if (label) {
        return this.cleanText(label.textContent || '');
      }
    }

    // 父级 label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLLabelElement;
      const inputs = clone.querySelectorAll('input, select, textarea');
      for (const input of Array.from(inputs)) {
        input.remove();
      }
      return this.cleanText(clone.textContent || '');
    }

    return null;
  }

  /**
   * 查找 ARIA 标签
   */
  private findAriaLabel(element: FormFieldElement): string | null {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return this.cleanText(ariaLabel);
    }

    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement) {
        return this.cleanText(labelElement.textContent || '');
      }
    }

    return null;
  }

  /**
   * 查找位置标签（左侧或上方）
   * 使用 TreeWalker 遍历文本节点，计算距离
   * 优化：限制遍历范围到最近的表单容器，避免遍历整个 document.body
   */
  private findPositionalLabel(
    element: FormFieldElement,
    direction: 'left' | 'top',
  ): string | null {
    if (this.labelCache.has(element)) {
      return this.labelCache.get(element) || null;
    }

    // 找到最近的表单容器，限制遍历范围
    const container =
      element.closest('form') ||
      element.closest('[role="form"]') ||
      element.parentElement?.parentElement ||
      document.body;

    const rect = element.getBoundingClientRect();
    const threshold = direction === 'top'
      ? FORM_DETECTION_CONFIG.LABEL_DISTANCE_THRESHOLD_TOP
      : FORM_DETECTION_CONFIG.LABEL_DISTANCE_THRESHOLD_LEFT;
    const candidates: Array<{ element: Element; distance: number }> = [];

    const walker = document.createTreeWalker(
      container, // 使用容器而不是 document.body
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent?.trim();
          if (!text || text.length < FORM_DETECTION_CONFIG.POSITIONAL_LABEL_MIN_TEXT_LENGTH) {
            return NodeFilter.FILTER_REJECT;
          }

          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tagName = parent.tagName.toLowerCase();
          if (
            [
              'script',
              'style',
              'noscript',
              'input',
              'textarea',
              'select',
              'button',
              'a',
            ].includes(tagName)
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          // 对于上方标签，额外过滤
          if (direction === 'top') {
            let ancestor: HTMLElement | null = parent;
            let depth = 0;
            while (ancestor && depth < FORM_DETECTION_CONFIG.POSITIONAL_LABEL_CONTAINER_MAX_DEPTH) {
              const ancestorTag = ancestor.tagName.toLowerCase();
              if (['button', 'a'].includes(ancestorTag)) {
                return NodeFilter.FILTER_REJECT;
              }
              if (
                ancestor.className &&
                typeof ancestor.className === 'string' &&
                /\b(btn|button|cta|action)\b/i.test(ancestor.className)
              ) {
                return NodeFilter.FILTER_REJECT;
              }
              ancestor = ancestor.parentElement;
              depth++;
            }

            if (text.length < FORM_DETECTION_CONFIG.POSITIONAL_LABEL_MIN_TEXT_LENGTH_TOP) {
              return NodeFilter.FILTER_REJECT;
            }

            if (/^(or|and|with|continue|sign|login|register)$/i.test(text)) {
              return NodeFilter.FILTER_REJECT;
            }
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    let node: Node | null = walker.nextNode();
    while (node && candidates.length < FORM_DETECTION_CONFIG.POSITIONAL_LABEL_MAX_CANDIDATES) {
      const parent = node.parentElement;
      if (!parent) {
        node = walker.nextNode();
        continue;
      }

      const parentRect = parent.getBoundingClientRect();
      const distance = this.calculateDistance(rect, parentRect, direction);

      if (distance !== null && distance < threshold) {
        candidates.push({ element: parent, distance });
      }

      node = walker.nextNode();
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => a.distance - b.distance);
    const label = this.cleanText(candidates[0].element.textContent || '');

    this.labelCache.set(element, label);
    return label;
  }

  /**
   * 计算距离
   */
  private calculateDistance(
    fieldRect: DOMRect,
    labelRect: DOMRect,
    direction: 'left' | 'top',
  ): number | null {
    const verticalOverlap =
      Math.max(
        0,
        Math.min(fieldRect.bottom, labelRect.bottom) -
          Math.max(fieldRect.top, labelRect.top),
      ) > 0;

    switch (direction) {
      case 'left':
        if (!verticalOverlap || labelRect.right > fieldRect.left) return null;
        return fieldRect.left - labelRect.right;

      case 'top': {
        if (labelRect.bottom > fieldRect.top) return null;

        const horizontalOverlap =
          Math.min(fieldRect.right, labelRect.right) >
          Math.max(fieldRect.left, labelRect.left);

        if (!horizontalOverlap) {
          const horizontalDistance = Math.min(
            Math.abs(fieldRect.left - labelRect.right),
            Math.abs(labelRect.left - fieldRect.right),
          );
          if (horizontalDistance > FORM_DETECTION_CONFIG.LABEL_HORIZONTAL_DISTANCE_MAX) {
            return null;
          }
        }

        return fieldRect.top - labelRect.bottom;
      }

      default:
        return null;
    }
  }

  /**
   * 查找帮助文本
   */
  private findHelperText(element: FormFieldElement): string | null {
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy) {
      const helperElement = document.getElementById(describedBy);
      if (helperElement) {
        return this.cleanText(helperElement.textContent || '');
      }
    }

    const parent = element.parentElement;
    if (parent) {
      const helper = parent.querySelector(
        '[class*="help"], [class*="hint"], [class*="description"]',
      );
      if (helper && helper !== element) {
        return this.cleanText(helper.textContent || '');
      }
    }

    return null;
  }

  /**
   * 获取当前值
   */
  private getCurrentValue(element: FormFieldElement): string {
    if (element instanceof HTMLSelectElement) {
      return element.value || '';
    }
    if (element instanceof HTMLInputElement) {
      return element.value || '';
    }
    if (element instanceof HTMLTextAreaElement) {
      return element.value || '';
    }
    return '';
  }

  /**
   * 分类字段类型
   */
  private classifyFieldType(element: FormFieldElement): FieldType {
    if (element instanceof HTMLTextAreaElement) {
      return 'textarea';
    }

    if (element instanceof HTMLSelectElement) {
      return 'select';
    }

    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase();

      const typeMap: Record<string, FieldType> = {
        email: 'email',
        tel: 'tel',
        url: 'url',
        password: 'password',
        number: 'number',
        date: 'date',
      };

      return typeMap[type] || 'text';
    }

    return 'text';
  }

  /**
   * 推断字段用途
   */
  private inferFieldPurpose(
    metadata: Omit<FieldMetadata, 'fieldPurpose'>,
    fieldType: FieldType,
  ): FieldPurpose {
    // textarea 在评论表单中几乎总是正文输入框，避免被附近的
    // "Your email address will not be published" 之类提示文案误判为 email。
    if (fieldType === 'textarea') return 'unknown';
    if (fieldType === 'email') return 'email';
    if (fieldType === 'tel') return 'phone';

    const autocomplete = metadata.autocomplete?.toLowerCase();
    if (autocomplete) {
      const purpose = AUTOCOMPLETE_MAP[autocomplete];
      if (purpose) return purpose;
    }

    const allText = [
      metadata.labelTag,
      metadata.labelAria,
      metadata.labelData,
      metadata.labelLeft,
      metadata.labelTop,
      metadata.placeholder,
      metadata.name,
      metadata.id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    for (const { regex, purpose } of FIELD_PURPOSE_PATTERNS) {
      if (regex.test(allText)) {
        return purpose;
      }
    }

    return 'unknown';
  }

  /**
   * 清理文本
   */
  private cleanText(text: string): string | null {
    const cleaned = text
      .replace(/[\n\r\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned.length > 0 && cleaned.length < FORM_DETECTION_CONFIG.MAX_LABEL_TEXT_LENGTH
      ? cleaned
      : null;
  }
}
