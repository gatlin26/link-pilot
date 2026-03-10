/**
 * 置信度计算器
 * 计算表单检测和填充的置信度
 */

import type { FormField } from './form-detector';
import type { SiteTemplate } from '@extension/shared';

/**
 * 置信度等级
 */
export enum ConfidenceLevel {
  HIGH = 'high',      // > 0.9
  MEDIUM = 'medium',  // 0.6 - 0.9
  LOW = 'low'         // < 0.6
}

/**
 * 自动填充行为
 */
export enum AutoFillBehavior {
  AUTO_FILL = 'auto_fill',           // 自动填充
  PROMPT_USER = 'prompt_user',       // 提示用户
  MANUAL_ONLY = 'manual_only'        // 仅手动
}

/**
 * 置信度计算器
 */
export class ConfidenceCalculator {
  /**
   * 根据置信度决定行为
   */
  decideBehavior(confidence: number, autoFillThreshold = 0.9, promptThreshold = 0.6): AutoFillBehavior {
    if (confidence >= autoFillThreshold) {
      return AutoFillBehavior.AUTO_FILL;
    } else if (confidence >= promptThreshold) {
      return AutoFillBehavior.PROMPT_USER;
    } else {
      return AutoFillBehavior.MANUAL_ONLY;
    }
  }

  /**
   * 获取置信度等级
   */
  getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence > 0.9) {
      return ConfidenceLevel.HIGH;
    } else if (confidence >= 0.6) {
      return ConfidenceLevel.MEDIUM;
    } else {
      return ConfidenceLevel.LOW;
    }
  }

  /**
   * 计算表单检测置信度
   */
  calculateFormConfidence(
    fields: FormField[],
    template: SiteTemplate | null,
    historicalSuccessRate?: number
  ): number {
    if (fields.length === 0) return 0;

    let confidence = 0;

    // 1. 模板匹配 - 最高权重
    if (template) {
      confidence = template.confidence_score || 1.0;

      // 如果使用模板，检查字段完整度
      const requiredFields = template.field_mappings.filter(m => m.required);
      const foundRequired = fields.filter(f =>
        requiredFields.some(r => r.field_type === f.type)
      );

      const completeness = requiredFields.length > 0
        ? foundRequired.length / requiredFields.length
        : 1.0;

      confidence *= completeness;
    } else {
      // 2. 启发式检测 - 基于字段质量
      confidence = this.calculateHeuristicConfidence(fields);
    }

    // 3. 历史成功率影响
    if (historicalSuccessRate !== undefined) {
      confidence = confidence * 0.7 + historicalSuccessRate * 0.3;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 计算启发式检测的置信度
   */
  private calculateHeuristicConfidence(fields: FormField[]): number {
    // 字段权重
    const weights = {
      comment: 0.4,
      email: 0.2,
      name: 0.2,
      website: 0.1,
      submit: 0.1,
    };

    let totalConfidence = 0;
    let totalWeight = 0;

    for (const field of fields) {
      const weight = weights[field.type] || 0;
      totalConfidence += field.confidence * weight;
      totalWeight += weight;
    }

    // 字段完整度加成
    const hasComment = fields.some(f => f.type === 'comment');
    const hasEmail = fields.some(f => f.type === 'email');
    const hasName = fields.some(f => f.type === 'name');
    const hasSubmit = fields.some(f => f.type === 'submit');

    let completenessBonus = 0;
    if (hasComment && (hasEmail || hasName)) {
      completenessBonus = 0.1;
    }
    if (hasSubmit) {
      completenessBonus += 0.05;
    }

    const baseConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;
    return Math.min(baseConfidence + completenessBonus, 1.0);
  }

  /**
   * 计算模板置信度（用于保存模板时）
   */
  calculateTemplateConfidence(
    learningSource: 'auto' | 'user_assisted',
    usageCount: number,
    successCount: number
  ): number {
    // 用户辅助学习的模板初始置信度更高
    let baseConfidence = learningSource === 'user_assisted' ? 0.95 : 0.7;

    // 根据使用统计调整
    if (usageCount > 0) {
      const successRate = successCount / usageCount;
      baseConfidence = baseConfidence * 0.3 + successRate * 0.7;
    }

    return Math.min(baseConfidence, 1.0);
  }
}

/**
 * 导出单例
 */
export const confidenceCalculator = new ConfidenceCalculator();
