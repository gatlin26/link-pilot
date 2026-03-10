/**
 * 用户辅助学习服务
 * 检测用户手动填充表单，并学习字段映射
 */

import { fieldTypeInferrer } from './field-type-inferrer';
import type { FieldInfo, InferenceResult, FieldType } from './field-type-inferrer';
import { templateLearner } from '../template/template-learner';
import { extensionSettingsStorage } from '@extension/storage';
import type { FormField } from './form-detector';

/**
 * 学习状态
 */
export enum LearningState {
  IDLE = 'idle',                    // 空闲
  MONITORING = 'monitoring',        // 监听中
  DETECTED = 'detected',            // 检测到填充
  CONFIRMING = 'confirming',        // 等待用户确认
  LEARNING = 'learning',            // 学习中
  COMPLETED = 'completed',          // 完成
}

/**
 * 检测到的字段
 */
export interface DetectedField {
  /** DOM 元素 */
  element: HTMLElement;
  /** 字段值 */
  value: string;
  /** 选择器 */
  selector: string;
  /** 推断的类型 */
  inferredType: FieldType;
  /** 推断置信度 */
  confidence: number;
  /** 推断依据 */
  reasons: string[];
  /** 用户确认的类型（如果有） */
  confirmedType?: FieldType;
}

/**
 * 学习会话
 */
export interface LearningSession {
  /** 会话 ID */
  id: string;
  /** 状态 */
  state: LearningState;
  /** 检测到的字段 */
  detectedFields: DetectedField[];
  /** 开始时间 */
  startedAt: string;
  /** 完成时间 */
  completedAt?: string;
}

/**
 * 用户辅助学习服务
 */
export class AssistedLearningService {
  /** 当前学习会话 */
  private currentSession: LearningSession | null = null;

  /** 监听的表单元素 */
  private monitoredForms: Set<HTMLFormElement> = new Set();

  /** 字段变更监听器 */
  private fieldChangeListeners: Map<HTMLElement, () => void> = new Map();

  /**
   * 开始监听用户填充
   */
  startMonitoring(): void {
    if (this.currentSession?.state === LearningState.MONITORING) {
      return; // 已在监听中
    }

    // 创建新会话
    this.currentSession = {
      id: this.generateSessionId(),
      state: LearningState.MONITORING,
      detectedFields: [],
      startedAt: new Date().toISOString(),
    };

    // 查找页面上的所有表单
    const forms = document.querySelectorAll('form');
    forms.forEach(form => this.monitorForm(form));

    console.log('[AssistedLearning] 开始监听用户填充');
  }

  /**
   * 停止监听
   */
  stopMonitoring(): void {
    // 移除所有监听器
    this.fieldChangeListeners.forEach((listener, element) => {
      element.removeEventListener('input', listener);
      element.removeEventListener('change', listener);
    });

    this.fieldChangeListeners.clear();
    this.monitoredForms.clear();

    if (this.currentSession) {
      this.currentSession.state = LearningState.IDLE;
    }

    console.log('[AssistedLearning] 停止监听');
  }

  /**
   * 监听表单
   */
  private monitorForm(form: HTMLFormElement): void {
    if (this.monitoredForms.has(form)) {
      return;
    }

    this.monitoredForms.add(form);

    // 查找所有输入字段
    const inputs = form.querySelectorAll('input, textarea');

    inputs.forEach(input => {
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
        return;
      }

      // 跳过某些类型的输入
      const type = input.getAttribute('type')?.toLowerCase();
      if (type === 'hidden' || type === 'password' || type === 'file') {
        return;
      }

      // 创建监听器
      const listener = () => this.onFieldChange(input);

      // 添加事件监听
      input.addEventListener('input', listener);
      input.addEventListener('change', listener);

      this.fieldChangeListeners.set(input, listener);
    });
  }

  /**
   * 字段变更处理
   */
  private onFieldChange(element: HTMLInputElement | HTMLTextAreaElement): void {
    if (!this.currentSession || this.currentSession.state !== LearningState.MONITORING) {
      return;
    }

    const value = element.value.trim();

    // 忽略空值
    if (!value) {
      return;
    }

    // 检查是否已记录
    const existing = this.currentSession.detectedFields.find(f => f.element === element);
    if (existing) {
      // 更新值
      existing.value = value;
      return;
    }

    // 生成选择器
    const selector = this.generateSelector(element);

    // 推断字段类型
    const fieldInfo: FieldInfo = {
      element,
      value,
      selector,
    };

    const inference = fieldTypeInferrer.infer(fieldInfo);

    // 记录检测到的字段
    const detectedField: DetectedField = {
      element,
      value,
      selector,
      inferredType: inference.fieldType,
      confidence: inference.confidence,
      reasons: inference.reasons,
    };

    this.currentSession.detectedFields.push(detectedField);

    console.log('[AssistedLearning] 检测到字段填充:', {
      selector,
      value: value.substring(0, 20) + '...',
      type: inference.fieldType,
      confidence: inference.confidence,
    });

    // 检查是否应该提示用户
    this.checkShouldPrompt();
  }

  /**
   * 检查是否应该提示用户保存模板
   */
  private async checkShouldPrompt(): Promise<void> {
    if (!this.currentSession) return;

    const fields = this.currentSession.detectedFields;

    // 至少需要 2 个字段
    if (fields.length < 2) return;

    // 检查是否有评论字段
    const hasComment = fields.some(f => f.inferredType === 'comment');

    // 检查是否有姓名或邮箱
    const hasNameOrEmail = fields.some(f => f.inferredType === 'name' || f.inferredType === 'email');

    // 如果满足条件，切换到检测完成状态
    if (hasComment && hasNameOrEmail) {
      this.currentSession.state = LearningState.DETECTED;
      console.log('[AssistedLearning] 检测到完整的表单填充，可以提示用户');

      // 触发事件通知 UI
      this.notifyDetected();
    }
  }

  /**
   * 通知检测完成
   */
  private notifyDetected(): void {
    // 触发自定义事件
    const event = new CustomEvent('assisted-learning-detected', {
      detail: {
        sessionId: this.currentSession?.id,
        fieldCount: this.currentSession?.detectedFields.length,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): LearningSession | null {
    return this.currentSession;
  }

  /**
   * 用户确认字段映射
   */
  confirmFieldMapping(element: HTMLElement, fieldType: FieldType): void {
    if (!this.currentSession) return;

    const field = this.currentSession.detectedFields.find(f => f.element === element);
    if (field) {
      field.confirmedType = fieldType;
    }
  }

  /**
   * 保存学习到的模板
   */
  async saveTemplate(): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    const settings = await extensionSettingsStorage.get();
    if (!settings.enable_assisted_learning) {
      return false;
    }

    this.currentSession.state = LearningState.LEARNING;

    try {
      // 转换为 FormField 格式
      const formFields: FormField[] = this.currentSession.detectedFields
        .filter(f => f.inferredType !== 'unknown' && f.inferredType !== 'submit')
        .map(f => ({
          type: (f.confirmedType || f.inferredType) as any,
          element: f.element,
          selector: f.selector,
          confidence: f.confirmedType ? 1.0 : f.confidence,
        }));

      // 使用模板学习器保存
      const result = await templateLearner.learnFromCurrentPage(formFields, 'user_assisted');

      if (result.success) {
        this.currentSession.state = LearningState.COMPLETED;
        this.currentSession.completedAt = new Date().toISOString();

        console.log('[AssistedLearning] 模板保存成功:', result.templateId);

        // 触发完成事件
        const event = new CustomEvent('assisted-learning-completed', {
          detail: {
            sessionId: this.currentSession.id,
            templateId: result.templateId,
            isNew: result.isNew,
          },
        });
        window.dispatchEvent(event);

        return true;
      } else {
        console.error('[AssistedLearning] 模板保存失败:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[AssistedLearning] 保存模板时出错:', error);
      this.currentSession.state = LearningState.DETECTED;
      return false;
    }
  }

  /**
   * 取消学习
   */
  cancelLearning(): void {
    if (this.currentSession) {
      this.currentSession.state = LearningState.IDLE;
      this.currentSession = null;
    }

    this.stopMonitoring();
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

    // 使用 CSS 路径
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.className) {
        const classes = current.className
          .split(' ')
          .filter(c => c && !c.startsWith('wp-') && !c.startsWith('post-'))
          .slice(0, 2);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      path.unshift(selector);
      current = current.parentElement;

      if (path.length >= 4) break;
    }

    return path.join(' > ');
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 导出单例
 */
export const assistedLearningService = new AssistedLearningService();
