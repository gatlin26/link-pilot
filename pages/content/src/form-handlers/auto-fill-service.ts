/**
 * 自动填充服务
 * 负责填充表单字段
 */

import type { FormField } from './form-detector';
import { confidenceCalculator, AutoFillBehavior, ConfidenceLevel } from './confidence-calculator';
import { extensionSettingsStorage } from '@extension/storage';
import {
  fillWithHumanTyping,
  fillWithNativeSetter,
  fillReactSelect,
  fillSelectElement,
  isReactSelect,
} from './fill-strategies';
import { FillStrategyError, withTimeout } from '@extension/shared';

/**
 * 填充数据
 */
export interface FillData {
  name?: string;
  email?: string;
  website?: string;
  comment?: string;
}

/**
 * 填充结果
 */
export interface FillResult {
  /** 是否成功 */
  success: boolean;
  /** 已填充的字段 */
  filledFields: string[];
  /** 失败的字段 */
  failedFields: string[];
  /** 错误信息 */
  error?: string;
}

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
   * 增强：添加超时控制，防止操作卡住
   */
  async fill(fields: FormField[], data: FillData, autoSubmit = false): Promise<FillResult> {
    try {
      // 使用超时控制包装填充操作
      return await withTimeout(
        this.fillInternal(fields, data, autoSubmit),
        10000, // 10 秒超时
        '表单填充超时',
      );
    } catch (error) {
      console.error('表单填充失败', error);
      return {
        success: false,
        filledFields: [],
        failedFields: fields.map((f) => f.type),
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 内部填充逻辑
   */
  private async fillInternal(
    fields: FormField[],
    data: FillData,
    autoSubmit: boolean,
  ): Promise<FillResult> {
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
   * 使用策略模式：Human Typing (首选) → Native Setter (降级) → React Select (特殊处理)
   * 增强：验证填充结果，确保降级策略生效
   */
  private async fillField(element: HTMLElement, value: string): Promise<void> {
    // 聚焦元素（preventScroll 避免页面跳动）
    element.focus({ preventScroll: true });

    // 策略1: HTMLInputElement 或 HTMLTextAreaElement
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      // 特殊处理：React Select 组件
      if (element instanceof HTMLInputElement && isReactSelect(element)) {
        const success = await fillReactSelect(element, value);
        if (!success) {
          console.warn('React Select 填充失败，尝试降级策略', {
            id: element.id,
            name: element.name,
          });
          fillWithNativeSetter(element, value);
        }
      } else {
        // 首选策略：Human Typing（模拟人类输入）
        const success = await fillWithHumanTyping(element, value);

        // 降级策略：Native Setter（如果 Human Typing 失败）
        if (!success) {
          console.debug('Human Typing 失败，降级到 Native Setter', {
            id: element.id,
            name: element.name,
          });
          fillWithNativeSetter(element, value);
        }
      }

      // 验证填充结果
      if (element.value !== value) {
        const error = new FillStrategyError(
          `字段填充失败: 期望 "${value}", 实际 "${element.value}"`,
          element,
          'validation',
        );
        console.error('字段填充验证失败', {
          expected: value,
          actual: element.value,
          id: element.id,
          name: element.name,
        });
        throw error;
      }

      return;
    }

    // 策略2: HTMLSelectElement
    if (element instanceof HTMLSelectElement) {
      fillSelectElement(element, value);
      return;
    }

    // 未知元素类型，记录警告
    console.warn('未知的表单元素类型:', element);
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
