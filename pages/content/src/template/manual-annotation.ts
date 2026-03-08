/**
 * 手动标注功能
 * 允许用户点击页面元素来标注表单字段
 */

import { templateLearner } from './template-learner';
import type { FormField } from '../form-handlers/form-detector';
import { PageType } from '@extension/shared';

/**
 * 字段类型
 */
export type FieldType = 'name' | 'email' | 'website' | 'comment' | 'submit';

/**
 * 标注状态
 */
export interface AnnotationState {
  /** 是否正在标注 */
  active: boolean;
  /** 当前标注的字段类型 */
  currentFieldType: FieldType | null;
  /** 已标注的字段 */
  annotatedFields: FormField[];
}

/**
 * 手动标注器
 */
export class ManualAnnotation {
  private state: AnnotationState = {
    active: false,
    currentFieldType: null,
    annotatedFields: [],
  };

  private overlay: HTMLDivElement | null = null;
  private highlightedElement: HTMLElement | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * 开始标注
   */
  start(): void {
    if (this.state.active) return;

    this.state.active = true;
    this.state.annotatedFields = [];

    // 创建覆盖层
    this.createOverlay();

    // 显示提示 UI
    this.showInstructions();

    // 监听点击事件
    this.clickHandler = this.handleClick.bind(this);
    document.addEventListener('click', this.clickHandler, true);

    // 监听鼠标移动事件（高亮元素）
    this.mouseMoveHandler = this.handleMouseMove.bind(this);
    document.addEventListener('mousemove', this.mouseMoveHandler, true);
  }

  /**
   * 停止标注
   */
  stop(): void {
    if (!this.state.active) return;

    this.state.active = false;
    this.state.currentFieldType = null;

    // 移除覆盖层
    this.removeOverlay();

    // 移除事件监听
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }

    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler, true);
      this.mouseMoveHandler = null;
    }

    // 移除高亮
    this.removeHighlight();
  }

  /**
   * 标注字段
   */
  annotateField(fieldType: FieldType): void {
    if (!this.state.active) {
      this.start();
    }

    this.state.currentFieldType = fieldType;
    this.updateInstructions(`请点击 ${this.getFieldTypeName(fieldType)} 字段`);
  }

  /**
   * 保存标注
   */
  async save(): Promise<void> {
    if (this.state.annotatedFields.length === 0) {
      throw new Error('没有标注任何字段');
    }

    // 学习模板
    const result = await templateLearner.learnFromCurrentPage(this.state.annotatedFields);

    if (!result.success) {
      throw new Error(result.error || '保存模板失败');
    }

    // 停止标注
    this.stop();

    // 清空已标注字段
    this.state.annotatedFields = [];

    console.log('模板保存成功:', result);
  }

  /**
   * 获取标注状态
   */
  getState(): AnnotationState {
    return { ...this.state };
  }

  /**
   * 处理点击事件
   */
  private handleClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();

    if (!this.state.currentFieldType) return;

    const target = e.target as HTMLElement;

    // 忽略覆盖层和提示 UI
    if (target.closest('.manual-annotation-overlay')) return;

    // 生成选择器
    const selector = this.generateSelector(target);

    // 添加到已标注字段
    const field: FormField = {
      type: this.state.currentFieldType,
      element: target,
      selector,
      confidence: 1.0, // 手动标注置信度最高
    };

    // 移除同类型的旧标注
    this.state.annotatedFields = this.state.annotatedFields.filter(
      f => f.type !== this.state.currentFieldType
    );

    this.state.annotatedFields.push(field);

    // 显示成功提示
    this.showSuccess(`已标注 ${this.getFieldTypeName(this.state.currentFieldType)}`);

    // 重置当前字段类型
    this.state.currentFieldType = null;
    this.updateInstructions('请选择要标注的字段类型');
  }

  /**
   * 处理鼠标移动事件
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.state.currentFieldType) return;

    const target = e.target as HTMLElement;

    // 忽略覆盖层和提示 UI
    if (target.closest('.manual-annotation-overlay')) return;

    // 高亮元素
    this.highlightElement(target);
  }

  /**
   * 生成选择器
   */
  private generateSelector(element: HTMLElement): string {
    // 优先使用 id
    if (element.id) {
      return `#${element.id}`;
    }

    // 其次使用 name
    const name = element.getAttribute('name');
    if (name) {
      const tagName = element.tagName.toLowerCase();
      return `${tagName}[name="${name}"]`;
    }

    // 最后使用 CSS 选择器
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      // 添加 id
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }

      // 添加类名
      if (current.className) {
        const classes = current.className
          .split(' ')
          .filter(c => c && !c.startsWith('manual-annotation-'))
          .slice(0, 2);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      // 添加 nth-child
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current);
        if (index > 0) {
          selector += `:nth-child(${index + 1})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;

      // 限制路径深度
      if (path.length >= 5) break;
    }

    return path.join(' > ');
  }

  /**
   * 创建覆盖层
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'manual-annotation-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.1);
      z-index: 999999;
      pointer-events: none;
    `;
    document.body.appendChild(this.overlay);
  }

  /**
   * 移除覆盖层
   */
  private removeOverlay(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  /**
   * 高亮元素
   */
  private highlightElement(element: HTMLElement): void {
    // 移除旧高亮
    this.removeHighlight();

    // 添加新高亮
    this.highlightedElement = element;
    element.style.outline = '2px solid #4CAF50';
    element.style.outlineOffset = '2px';
  }

  /**
   * 移除高亮
   */
  private removeHighlight(): void {
    if (this.highlightedElement) {
      this.highlightedElement.style.outline = '';
      this.highlightedElement.style.outlineOffset = '';
      this.highlightedElement = null;
    }
  }

  /**
   * 显示提示
   */
  private showInstructions(): void {
    const instructions = document.createElement('div');
    instructions.id = 'manual-annotation-instructions';
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #333;
    `;
    instructions.textContent = '请选择要标注的字段类型';
    document.body.appendChild(instructions);
  }

  /**
   * 更新提示
   */
  private updateInstructions(text: string): void {
    const instructions = document.getElementById('manual-annotation-instructions');
    if (instructions) {
      instructions.textContent = text;
    }
  }

  /**
   * 显示成功提示
   */
  private showSuccess(text: string): void {
    const success = document.createElement('div');
    success.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      z-index: 1000001;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      animation: fadeInOut 2s ease-in-out;
    `;
    success.textContent = text;
    document.body.appendChild(success);

    // 2 秒后移除
    setTimeout(() => {
      success.remove();
    }, 2000);
  }

  /**
   * 获取字段类型名称
   */
  private getFieldTypeName(fieldType: FieldType): string {
    const names: Record<FieldType, string> = {
      name: '姓名',
      email: '邮箱',
      website: '网站',
      comment: '评论',
      submit: '提交按钮',
    };
    return names[fieldType] || fieldType;
  }
}

/**
 * 导出单例
 */
export const manualAnnotation = new ManualAnnotation();

/**
 * 添加 CSS 动画
 */
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      10% { opacity: 1; transform: translateX(-50%) translateY(0); }
      90% { opacity: 1; transform: translateX(-50%) translateY(0); }
      100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
  `;
  document.head.appendChild(style);
}
