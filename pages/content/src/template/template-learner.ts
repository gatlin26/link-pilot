/**
 * 模板学习服务
 * 从成功提交中学习表单模板
 */

import { templateStorage } from '@extension/storage';
import type { SiteTemplate, FieldMapping } from '@extension/shared';
import { PageType } from '@extension/shared';
import type { FormField } from '../form-handlers/form-detector';
import { confidenceCalculator } from '../form-handlers/confidence-calculator';

/**
 * 学习结果
 */
export interface LearnResult {
  /** 是否成功 */
  success: boolean;
  /** 模板 ID */
  templateId?: string;
  /** 是否为新模板 */
  isNew: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 模板学习器
 */
export class TemplateLearner {
  /**
   * 从成功提交学习模板
   */
  async learnFromSubmission(
    domain: string,
    pageType: PageType,
    path: string,
    fields: FormField[],
    learningSource: 'auto' | 'user_assisted' = 'auto'
  ): Promise<LearnResult> {
    try {
      // 生成路径模式
      const pathPattern = this.generatePathPattern(path);

      // 查找现有模板
      const existingTemplate = await templateStorage.getLatestVersion(
        domain,
        pageType,
        pathPattern
      );

      // 生成字段映射
      const fieldMappings = this.generateFieldMappings(fields);

      if (existingTemplate) {
        // 检查是否需要更新
        if (this.shouldUpdateTemplate(existingTemplate, fieldMappings)) {
          // 创建新版本
          const confidence = confidenceCalculator.calculateTemplateConfidence(
            learningSource,
            existingTemplate.usage_count || 0,
            existingTemplate.success_count || 0
          );

          const newTemplate: SiteTemplate = {
            id: this.generateId(),
            domain,
            page_type: pageType,
            path_pattern: pathPattern,
            field_mappings: fieldMappings,
            submit_selector: this.getSubmitSelector(fields),
            version: existingTemplate.version + 1,
            updated_at: new Date().toISOString(),
            learning_source: learningSource,
            usage_count: 0,
            success_count: 0,
            confidence_score: confidence,
          };

          await templateStorage.add(newTemplate);

          return {
            success: true,
            templateId: newTemplate.id,
            isNew: false,
          };
        } else {
          // 不需要更新
          return {
            success: true,
            templateId: existingTemplate.id,
            isNew: false,
          };
        }
      } else {
        // 创建新模板
        const confidence = confidenceCalculator.calculateTemplateConfidence(
          learningSource,
          0,
          0
        );

        const newTemplate: SiteTemplate = {
          id: this.generateId(),
          domain,
          page_type: pageType,
          path_pattern: pathPattern,
          field_mappings: fieldMappings,
          submit_selector: this.getSubmitSelector(fields),
          version: 1,
          updated_at: new Date().toISOString(),
          learning_source: learningSource,
          usage_count: 0,
          success_count: 0,
          confidence_score: confidence,
        };

        await templateStorage.add(newTemplate);

        return {
          success: true,
          templateId: newTemplate.id,
          isNew: true,
        };
      }
    } catch (error) {
      return {
        success: false,
        isNew: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 生成路径模式
   */
  private generatePathPattern(path: string): string {
    // 将数字替换为通配符
    // 例如: /post/123/comment -> /post/*/comment
    return path.replace(/\/\d+/g, '/*');
  }

  /**
   * 生成字段映射
   */
  private generateFieldMappings(fields: FormField[]): FieldMapping[] {
    return fields
      .filter(f => f.type !== 'submit')
      .map(field => ({
        field_type: field.type,
        selector: field.selector,
        required: this.isFieldRequired(field),
        default_value: undefined,
      }));
  }

  /**
   * 获取提交按钮选择器
   */
  private getSubmitSelector(fields: FormField[]): string {
    const submitField = fields.find(f => f.type === 'submit');
    return submitField?.selector || 'button[type="submit"]';
  }

  /**
   * 判断字段是否必填
   */
  private isFieldRequired(field: FormField): boolean {
    const element = field.element;

    // 检查 required 属性
    if (element.hasAttribute('required')) {
      return true;
    }

    // 评论字段通常是必填的
    if (field.type === 'comment') {
      return true;
    }

    // 邮箱或姓名通常至少有一个是必填的
    if (field.type === 'email' || field.type === 'name') {
      return true;
    }

    return false;
  }

  /**
   * 判断是否需要更新模板
   */
  private shouldUpdateTemplate(
    existingTemplate: SiteTemplate,
    newMappings: FieldMapping[]
  ): boolean {
    // 如果字段数量不同，需要更新
    if (existingTemplate.field_mappings.length !== newMappings.length) {
      return true;
    }

    // 检查每个字段的选择器是否相同
    for (const newMapping of newMappings) {
      const existingMapping = existingTemplate.field_mappings.find(
        m => m.field_type === newMapping.field_type
      );

      if (!existingMapping) {
        return true; // 新增字段
      }

      if (existingMapping.selector !== newMapping.selector) {
        return true; // 选择器变化
      }
    }

    return false;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 从当前页面学习模板
   */
  async learnFromCurrentPage(
    fields: FormField[],
    learningSource: 'auto' | 'user_assisted' = 'auto'
  ): Promise<LearnResult> {
    const domain = this.extractDomain(window.location.href);
    const path = window.location.pathname;

    // 判断页面类型（目前只支持博客评论）
    const pageType = PageType.BLOG_COMMENT;

    return this.learnFromSubmission(domain, pageType, path, fields, learningSource);
  }

  /**
   * 提取域名
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }
}

/**
 * 导出单例
 */
export const templateLearner = new TemplateLearner();
