/**
 * 自动填充服务
 * 负责填充表单字段
 */

import type { FormField } from './form-detector';
import { confidenceCalculator, AutoFillBehavior, ConfidenceLevel } from './confidence-calculator';
import { extensionSettingsStorage } from '@extension/storage';
import type { FillData, FillResult } from '@extension/shared';

/**
 * 填充决策
 */
export interface FillDecision {
  /** 建议的行为 */
  behavior: AutoFillBehavior;
  /** 置信度等级 */
  confidenceLevel: ConfidenceLevel;
  /** 置信度分数 */
  confidence: number;
  /** 是否应该自动填充 */
  shouldAutoFill: boolean;
  /** 是否应该提示用户 */
  shouldPromptUser: boolean;
}

/**
 * 自动填充服务
 */
export class AutoFillService {
  /** 保存填充前的字段值，用于撤销 */
  private previousValues: Map<HTMLElement, string> = new Map();

  /**
   * 决定是否应该填充表单
   */
  async decideFill(confidence: number): Promise<FillDecision> {
    const settings = await extensionSettingsStorage.get();
    const autoFillThreshold = settings.auto_fill_confidence_threshold || 0.9;
    const promptThreshold = settings.prompt_confidence_threshold || 0.6;

    const behavior = confidenceCalculator.decideBehavior(
      confidence,
      autoFillThreshold,
      promptThreshold
    );
    const confidenceLevel = confidenceCalculator.getConfidenceLevel(confidence);

    return {
      behavior,
      confidenceLevel,
      confidence,
      shouldAutoFill: behavior === AutoFillBehavior.AUTO_FILL,
      shouldPromptUser: behavior === AutoFillBehavior.PROMPT_USER,
    };
  }
  /**
   * 填充表单
   */
  async fill(fields: FormField[], data: FillData, autoSubmit = false): Promise<FillResult> {
    const filledFields: string[] = [];
    const failedFields: string[] = [];

    try {
      // 清空之前的撤销数据
      this.previousValues.clear();

      // 保存填充前的值
      for (const field of fields) {
        if (field.type === 'submit') continue;
        if (field.element instanceof HTMLInputElement || field.element instanceof HTMLTextAreaElement) {
          this.previousValues.set(field.element, field.element.value);
        }
      }

      // 填充各个字段
      for (const field of fields) {
        if (field.type === 'submit') continue; // 跳过提交按钮

        const value = data[field.type];
        if (!value) continue;

        try {
          await this.fillField(field.element, value);
          filledFields.push(field.type);
        } catch (error) {
          console.error(`填充字段 ${field.type} 失败:`, error);
          failedFields.push(field.type);
        }
      }

      // 验证填充结果
      const validated = this.validateFill(fields, data);
      if (!validated) {
        return {
          success: false,
          filledFields,
          failedFields,
          error: '填充验证失败',
        };
      }

      // 自动提交（如果启用）
      if (autoSubmit) {
        const submitField = fields.find(f => f.type === 'submit');
        if (submitField) {
          await this.clickSubmit(submitField.element);
        }
      }

      return {
        success: true,
        filledFields,
        failedFields,
      };
    } catch (error) {
      return {
        success: false,
        filledFields,
        failedFields,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 撤销填充
   */
  undo(): boolean {
    if (this.previousValues.size === 0) {
      return false;
    }

    try {
      this.previousValues.forEach((value, element) => {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          element.value = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      this.previousValues.clear();
      return true;
    } catch (error) {
      console.error('撤销填充失败:', error);
      return false;
    }
  }

  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return this.previousValues.size > 0;
  }

  /**
   * 填充单个字段
   */
  private async fillField(element: HTMLElement, value: string): Promise<void> {
    // 聚焦元素
    element.focus();

    // 设置值
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      // 使用原生 setter 触发 React/Vue 等框架的变更检测
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        element.constructor.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value);
      } else {
        element.value = value;
      }

      // 触发事件
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 失焦
    element.blur();

    // 等待一小段时间确保事件处理完成
    await this.sleep(100);
  }

  /**
   * 点击提交按钮
   */
  private async clickSubmit(element: HTMLElement): Promise<void> {
    // 等待一小段时间确保所有字段都已填充
    await this.sleep(500);

    // 触发点击事件
    element.click();
  }

  /**
   * 验证填充结果
   */
  private validateFill(fields: FormField[], data: FillData): boolean {
    for (const field of fields) {
      if (field.type === 'submit') continue;

      const value = data[field.type];
      if (!value) continue;

      const element = field.element;
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (element.value !== value) {
          console.warn(`字段 ${field.type} 验证失败: 期望 "${value}", 实际 "${element.value}"`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 获取默认填充数据
   */
  getDefaultData(): FillData {
    return {
      name: 'John Doe',
      email: 'john.doe@example.com',
      website: 'https://example.com',
      comment: 'Great article! Thanks for sharing.',
    };
  }

  /**
   * 从配置读取填充数据
   */
  async getDataFromConfig(): Promise<FillData> {
    // TODO: 从 chrome.storage 读取用户配置的数据
    // 目前返回默认数据
    return this.getDefaultData();
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 导出单例
 */
export const autoFillService = new AutoFillService();
