/**
 * 字段类型推断引擎
 * 根据字段值、属性和上下文推断字段类型
 */

/**
 * 字段类型
 */
export type FieldType = 'name' | 'email' | 'website' | 'comment' | 'submit' | 'unknown';

/**
 * 推断结果
 */
export interface InferenceResult {
  /** 推断的字段类型 */
  fieldType: FieldType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 推断依据 */
  reasons: string[];
}

/**
 * 字段信息
 */
export interface FieldInfo {
  /** DOM 元素 */
  element: HTMLElement;
  /** 字段值 */
  value: string;
  /** 选择器 */
  selector: string;
}

/**
 * 字段类型推断器
 */
export class FieldTypeInferrer {
  /**
   * 推断字段类型
   */
  infer(fieldInfo: FieldInfo): InferenceResult {
    const { element, value } = fieldInfo;

    // 1. 根据字段值格式推断
    const valueInference = this.inferFromValue(value);
    if (valueInference.confidence > 0.8) {
      return valueInference;
    }

    // 2. 根据字段属性推断
    const attributeInference = this.inferFromAttributes(element);
    if (attributeInference.confidence > 0.7) {
      return attributeInference;
    }

    // 3. 综合推断
    return this.combineInferences(valueInference, attributeInference);
  }

  /**
   * 根据字段值推断类型
   */
  private inferFromValue(value: string): InferenceResult {
    const reasons: string[] = [];
    let fieldType: FieldType = 'unknown';
    let confidence = 0;

    if (!value || value.trim().length === 0) {
      return { fieldType: 'unknown', confidence: 0, reasons: ['字段值为空'] };
    }

    // 邮箱格式检测
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(value)) {
      fieldType = 'email';
      confidence = 0.95;
      reasons.push('匹配邮箱格式');
      return { fieldType, confidence, reasons };
    }

    // URL 格式检测
    const urlRegex = /^https?:\/\/.+\..+/i;
    if (urlRegex.test(value)) {
      fieldType = 'website';
      confidence = 0.95;
      reasons.push('匹配 URL 格式');
      return { fieldType, confidence, reasons };
    }

    // 评论内容检测（较长的文本）
    if (value.length > 50) {
      fieldType = 'comment';
      confidence = 0.7;
      reasons.push('文本长度超过 50 字符');
      return { fieldType, confidence, reasons };
    }

    // 姓名检测（短文本，不包含特殊字符）
    const nameRegex = /^[\u4e00-\u9fa5a-zA-Z\s]{2,20}$/;
    if (nameRegex.test(value) && value.length <= 20) {
      fieldType = 'name';
      confidence = 0.6;
      reasons.push('匹配姓名格式（2-20个字符）');
      return { fieldType, confidence, reasons };
    }

    return { fieldType: 'unknown', confidence: 0, reasons: ['无法从值推断类型'] };
  }

  /**
   * 根据字段属性推断类型
   */
  private inferFromAttributes(element: HTMLElement): InferenceResult {
    const reasons: string[] = [];
    let fieldType: FieldType = 'unknown';
    let confidence = 0;

    const name = element.getAttribute('name')?.toLowerCase() || '';
    const id = element.id.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase() || '';
    const placeholder = element.getAttribute('placeholder')?.toLowerCase() || '';
    const tagName = element.tagName.toLowerCase();

    // 中英文关键词映射
    const keywords: Record<FieldType, string[]> = {
      name: ['name', 'author', '姓名', '昵称', '称呼'],
      email: ['email', 'e-mail', 'mail', '邮箱', '邮件'],
      website: ['url', 'website', 'site', 'homepage', '网址', '网站', '主页'],
      comment: ['comment', 'message', 'content', 'text', '评论', '留言', '内容'],
      submit: ['submit', 'post', 'send', '提交', '发表', '发送'],
      unknown: [],
    };

    // 检查 type 属性
    if (type === 'email') {
      fieldType = 'email';
      confidence = 0.9;
      reasons.push('type="email"');
      return { fieldType, confidence, reasons };
    }

    if (type === 'url') {
      fieldType = 'website';
      confidence = 0.9;
      reasons.push('type="url"');
      return { fieldType, confidence, reasons };
    }

    if (type === 'submit' || tagName === 'button') {
      fieldType = 'submit';
      confidence = 0.8;
      reasons.push(`${tagName} 元素`);
      return { fieldType, confidence, reasons };
    }

    // 检查 textarea
    if (tagName === 'textarea') {
      fieldType = 'comment';
      confidence = 0.85;
      reasons.push('textarea 元素');
      return { fieldType, confidence, reasons };
    }

    // 检查关键词匹配
    for (const [type, words] of Object.entries(keywords)) {
      if (type === 'unknown') continue;

      for (const word of words) {
        let matchCount = 0;
        let matchWeight = 0;

        if (name.includes(word)) {
          matchCount++;
          matchWeight += 0.4;
          reasons.push(`name 包含 "${word}"`);
        }

        if (id.includes(word)) {
          matchCount++;
          matchWeight += 0.3;
          reasons.push(`id 包含 "${word}"`);
        }

        if (placeholder.includes(word)) {
          matchCount++;
          matchWeight += 0.2;
          reasons.push(`placeholder 包含 "${word}"`);
        }

        if (matchCount > 0) {
          fieldType = type as FieldType;
          confidence = Math.min(matchWeight, 0.9);
          return { fieldType, confidence, reasons };
        }
      }
    }

    return { fieldType: 'unknown', confidence: 0, reasons: ['无法从属性推断类型'] };
  }

  /**
   * 综合多个推断结果
   */
  private combineInferences(
    valueInference: InferenceResult,
    attributeInference: InferenceResult
  ): InferenceResult {
    // 如果两个推断结果一致，提升置信度
    if (valueInference.fieldType === attributeInference.fieldType) {
      return {
        fieldType: valueInference.fieldType,
        confidence: Math.min(
          valueInference.confidence * 0.6 + attributeInference.confidence * 0.4,
          0.95
        ),
        reasons: [...valueInference.reasons, ...attributeInference.reasons],
      };
    }

    // 选择置信度更高的结果
    if (valueInference.confidence > attributeInference.confidence) {
      return valueInference;
    } else {
      return attributeInference;
    }
  }

  /**
   * 批量推断多个字段
   */
  inferBatch(fields: FieldInfo[]): Map<HTMLElement, InferenceResult> {
    const results = new Map<HTMLElement, InferenceResult>();

    for (const field of fields) {
      const result = this.infer(field);
      results.set(field.element, result);
    }

    return results;
  }
}

/**
 * 导出单例
 */
export const fieldTypeInferrer = new FieldTypeInferrer();
