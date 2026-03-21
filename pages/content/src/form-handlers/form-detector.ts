/**
 * 表单检测服务
 * 检测页面是否为博客评论页面，并识别表单字段
 */

import { templateStorage } from '@extension/storage';
import type { SiteTemplate, FieldMapping } from '@extension/shared';
import { PageType, logger, isElementVisible } from '@extension/shared';
import { FieldAnalyzer } from './field-analyzer';
import { ShadowDOMDetector } from './shadow-dom-detector';
import { FormObserver } from './form-observer';
import type { DetectedField as AnalyzerDetectedField, FormFieldElement } from '../types/field-analyzer';
import { mapFieldPurposeToLinkPilot, calculateFieldQuality } from '../utils/field-type-mapper';
import { DOM_CACHE } from '../utils/dom-cache';
import { performanceMonitor, MetricType } from '../utils/performance-monitor';
import { FORM_DETECTION_CONFIG } from '../config/constants';

/**
 * 表单字段检测结果
 */
export interface FormField {
  /** 字段类型 */
  type: 'name' | 'email' | 'website' | 'comment' | 'submit';
  /** DOM 元素 */
  element: HTMLElement;
  /** 选择器 */
  selector: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 是否必填 */
  required?: boolean;
}

/**
 * 表单检测结果
 */
export interface FormDetectionResult {
  /** 是否检测到表单 */
  detected: boolean;
  /** 页面类型 */
  pageType: PageType | null;
  /** 检测到的字段 */
  fields: FormField[];
  /** 使用的模板 */
  template: SiteTemplate | null;
  /** 整体置信度 */
  confidence: number;
}

/**
 * 表单检测器
 */
export class FormDetector {
  /** 字段分析器实例 */
  private fieldAnalyzer = new FieldAnalyzer();

  /** Shadow DOM 检测器实例 */
  private shadowDOMDetector = new ShadowDOMDetector(this.fieldAnalyzer);

  /** 表单监听器实例 */
  private formObserver: FormObserver | null = null;

  /** 动态表单变化回调 */
  private onFormChangeCallback: ((result: FormDetectionResult) => void) | null = null;

  /**
   * 检测页面表单
   */
  async detect(): Promise<FormDetectionResult> {
    const metricId = performanceMonitor.start(MetricType.FORM_DETECTION);

    try {
      const domain = this.extractDomain(window.location.href);
      const path = window.location.pathname;

      logger.info('开始检测表单', { domain, path });

      // 尝试使用模板
      const template = await this.findMatchingTemplate(domain, path);
      if (template) {
        logger.info('使用模板检测', { templateId: template.id });
        return this.detectWithTemplate(template);
      }

      // 使用启发式识别
      logger.info('使用启发式检测');
      return this.detectWithHeuristics();
    } finally {
      performanceMonitor.end(metricId);
    }
  }

  /**
   * 使用模板检测
   */
  private async detectWithTemplate(template: SiteTemplate): Promise<FormDetectionResult> {
    const fields: FormField[] = [];

    for (const mapping of template.field_mappings) {
      const element = document.querySelector(mapping.selector) as HTMLElement;
      if (element) {
        fields.push({
          type: mapping.field_type,
          element,
          selector: mapping.selector,
          confidence: 1.0, // 模板匹配置信度最高
        });
      }
    }

    // 如果所有必填字段都找到了，认为检测成功
    const requiredFields = template.field_mappings.filter(m => m.required);
    const foundRequired = fields.filter(f =>
      requiredFields.some(r => r.field_type === f.type)
    );

    const detected = foundRequired.length === requiredFields.length;
    const confidence = detected ? 1.0 : foundRequired.length / requiredFields.length;

    return {
      detected,
      pageType: template.page_type,
      fields,
      template,
      confidence,
    };
  }

  /**
   * 使用启发式规则检测
   */
  private async detectWithHeuristics(): Promise<FormDetectionResult> {
    const fields: FormField[] = [];

    // 清空 DOM 缓存
    DOM_CACHE.clear();

    // 第一步：使用 FieldAnalyzer 分析所有表单字段
    const analyzedFields = this.analyzeAllFormFields();

    // 第二步：检测 Shadow DOM 中的字段
    const shadowFields = this.shadowDOMDetector.detectShadowDOMFields(document.body, {
      maxDepth: FORM_DETECTION_CONFIG.SHADOW_DOM_MAX_DEPTH,
      includeDuplicates: false,
    });

    // 合并 Shadow DOM 字段到分析结果
    analyzedFields.push(...shadowFields);

    // 第三步：将分析结果映射到 link-pilot 字段类型
    for (const analyzed of analyzedFields) {
      const linkPilotType = mapFieldPurposeToLinkPilot(
        analyzed.metadata.fieldPurpose,
        analyzed.metadata,
      );

      if (linkPilotType) {
        // 计算字段质量分数
        const qualityScore = calculateFieldQuality(analyzed.metadata);

        // 只保留高质量字段（质量分数 >= 阈值）
        if (qualityScore >= FORM_DETECTION_CONFIG.FIELD_QUALITY_THRESHOLD) {
          fields.push({
            type: linkPilotType,
            element: analyzed.element as HTMLElement,
            selector: this.generateSelector(analyzed.element as HTMLElement),
            confidence: qualityScore,
            required: analyzed.metadata.required,
          });
        }
      }
    }

    // 第四步：如果 FieldAnalyzer 没有找到足够的字段，回退到原有的选择器匹配
    if (fields.length < FORM_DETECTION_CONFIG.MIN_FIELDS_FOR_HEURISTIC) {
      const fallbackFields = this.detectFieldsWithSelectors();
      // 合并结果，去重
      for (const fallbackField of fallbackFields) {
        const exists = fields.some(f => f.element === fallbackField.element);
        if (!exists) {
          fields.push(fallbackField);
        }
      }
    }

    // 判断是否为评论表单
    // 放宽条件：只要有评论字段就认为是评论表单
    // 某些平台（如社交媒体）不需要姓名/邮箱字段（用户已登录）
    const hasComment = fields.some(f => f.type === 'comment');
    const hasNameOrEmail = fields.some(f => f.type === 'name' || f.type === 'email');
    const detected = hasComment; // 只要有评论字段即可

    // 计算置信度
    const confidence = this.calculateConfidence(fields);

    return {
      detected,
      pageType: detected ? PageType.BLOG_COMMENT : null,
      fields,
      template: null,
      confidence,
    };
  }

  /**
   * 使用 FieldAnalyzer 分析所有表单字段
   */
  private analyzeAllFormFields(): AnalyzerDetectedField[] {
    const results: AnalyzerDetectedField[] = [];

    // 查找所有表单元素（包括 contenteditable）
    const formElements = document.querySelectorAll<FormFieldElement>(
      'input:not([type="hidden"]):not([type="password"]):not([type="file"]), textarea, select, [contenteditable="true"]',
    );

    for (const element of Array.from(formElements)) {
      // 检查是否可见
      if (!this.fieldAnalyzer.isElementVisible(element)) {
        continue;
      }

      // 分析字段
      const detectedField: AnalyzerDetectedField = {
        element,
        metadata: {} as any, // 临时占位
      };

      const metadata = this.fieldAnalyzer.analyzeField(detectedField);
      detectedField.metadata = metadata;

      results.push(detectedField);
    }

    return results;
  }

  /**
   * 使用选择器检测字段（回退方案）
   */
  private detectFieldsWithSelectors(): FormField[] {
    const fields: FormField[] = [];

    // 检测 name 字段（扩展中英文关键词）
    const nameField = this.detectField('name', [
      'input[name*="name"]:not([name*="email"]):not([name*="user"])',
      'input[id*="name"]:not([id*="email"]):not([id*="user"])',
      'input[placeholder*="name" i]:not([placeholder*="email" i])',
      'input[type="text"][name*="author"]',
      'input[name*="姓名"]',
      'input[id*="姓名"]',
      'input[placeholder*="姓名"]',
      'input[name*="昵称"]',
      'input[id*="昵称"]',
      'input[placeholder*="昵称"]',
      'input[name*="称呼"]',
      'input[placeholder*="您的名字"]',
      'input[placeholder*="your name" i]',
    ]);
    if (nameField) fields.push(nameField);

    // 检测 email 字段（扩展中英文关键词）
    const emailField = this.detectField('email', [
      'input[type="email"]',
      'input[name*="email"]',
      'input[id*="email"]',
      'input[placeholder*="email" i]',
      'input[name*="邮箱"]',
      'input[id*="邮箱"]',
      'input[placeholder*="邮箱"]',
      'input[name*="邮件"]',
      'input[placeholder*="电子邮件"]',
      'input[placeholder*="your email" i]',
      'input[placeholder*="e-mail" i]',
    ]);
    if (emailField) fields.push(emailField);

    // 检测 website 字段（扩展中英文关键词）
    const websiteField = this.detectField('website', [
      'input[name*="url"]',
      'input[name*="website"]',
      'input[name*="site"]',
      'input[id*="url"]',
      'input[id*="website"]',
      'input[placeholder*="website" i]',
      'input[placeholder*="url" i]',
      'input[type="url"]',
      'input[name*="网址"]',
      'input[id*="网址"]',
      'input[placeholder*="网址"]',
      'input[name*="网站"]',
      'input[id*="网站"]',
      'input[placeholder*="网站"]',
      'input[placeholder*="your website" i]',
      'input[placeholder*="your site" i]',
    ]);
    if (websiteField) fields.push(websiteField);

    // 检测 comment 字段（扩展中英文关键词 + contenteditable 支持）
    const commentField = this.detectField('comment', [
      'textarea[name*="comment"]',
      'textarea[id*="comment"]',
      'textarea[placeholder*="comment" i]',
      'textarea[name*="message"]',
      'textarea[id*="message"]',
      'textarea[name*="content"]',
      'textarea[name*="评论"]',
      'textarea[id*="评论"]',
      'textarea[placeholder*="评论"]',
      'textarea[name*="留言"]',
      'textarea[id*="留言"]',
      'textarea[placeholder*="留言"]',
      'textarea[name*="内容"]',
      'textarea[placeholder*="说点什么"]',
      'textarea[placeholder*="your comment" i]',
      'textarea[placeholder*="your message" i]',
      'textarea[placeholder*="write a comment" i]',
      // contenteditable 支持（通用）
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][aria-label*="comment" i]',
      'div[contenteditable="true"][aria-label*="评论"]',
      'div[contenteditable="true"][placeholder*="comment" i]',
      'div[contenteditable="true"][placeholder*="评论"]',
    ]);
    if (commentField) fields.push(commentField);

    // 检测 submit 按钮（扩展中英文关键词）
    const submitField = this.detectField('submit', [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Submit")',
      'button:contains("Post")',
      'button:contains("Send")',
      'button[name*="submit"]',
      'button[id*="submit"]',
      'button:contains("提交")',
      'button:contains("发表")',
      'button:contains("发送")',
      'button:contains("评论")',
      'input[value*="提交"]',
      'input[value*="发表"]',
      'input[value*="发送"]',
    ]);
    if (submitField) fields.push(submitField);

    return fields;
  }

  /**
   * 检测单个字段
   */
  private detectField(
    type: 'name' | 'email' | 'website' | 'comment' | 'submit',
    selectors: string[]
  ): FormField | null {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector) as HTMLElement;
        if (element && this.isVisible(element)) {
          return {
            type,
            element,
            selector: this.generateSelector(element),
            confidence: this.calculateFieldConfidence(element, type),
          };
        }
      } catch (error) {
        // 忽略无效的选择器
        continue;
      }
    }
    return null;
  }

  /**
   * 检查元素是否可见
   */
  private isVisible(element: HTMLElement): boolean {
    return isElementVisible(element);
  }

  /**
   * 生成稳定的选择器
   * 使用 CSS.escape 防止 XSS 攻击
   */
  private generateSelector(element: HTMLElement): string {
    // 优先使用 id（使用 CSS.escape 转义）
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    // 其次使用 name（使用 CSS.escape 转义）
    const name = element.getAttribute('name');
    if (name) {
      const tagName = element.tagName.toLowerCase();
      return `${tagName}[name="${CSS.escape(name)}"]`;
    }

    // 最后使用 CSS 选择器
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      // 添加类名（最多 2 个），使用 CSS.escape 转义每个 class
      if (current.className) {
        const classes = current.className
          .split(' ')
          .filter(c => c && !c.startsWith('wp-') && !c.startsWith('post-'))
          .slice(0, FORM_DETECTION_CONFIG.SELECTOR_MAX_CLASSES)
          .map(c => CSS.escape(c)); // 转义每个 class
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      path.unshift(selector);
      current = current.parentElement;

      // 限制路径深度
      if (path.length >= FORM_DETECTION_CONFIG.SELECTOR_MAX_PATH_DEPTH) break;
    }

    return path.join(' > ');
  }

  /**
   * 计算字段置信度
   */
  private calculateFieldConfidence(element: HTMLElement, type: string): number {
    let confidence = FORM_DETECTION_CONFIG.CONFIDENCE_BASE; // 基础置信度

    const name = element.getAttribute('name')?.toLowerCase() || '';
    const id = element.id.toLowerCase();
    const placeholder = element.getAttribute('placeholder')?.toLowerCase() || '';

    // 中英文关键词映射
    const keywords: Record<string, string[]> = {
      name: ['name', 'author', '姓名', '昵称', '称呼'],
      email: ['email', 'e-mail', '邮箱', '邮件'],
      website: ['url', 'website', 'site', '网址', '网站'],
      comment: ['comment', 'message', 'content', '评论', '留言', '内容'],
      submit: ['submit', 'post', 'send', '提交', '发表', '发送'],
    };

    // 根据属性匹配度提升置信度
    const typeKeywords = keywords[type] || [];
    for (const keyword of typeKeywords) {
      if (name.includes(keyword)) {
        confidence += FORM_DETECTION_CONFIG.CONFIDENCE_BOOST_NAME_MATCH;
      }
      if (id.includes(keyword)) {
        confidence += FORM_DETECTION_CONFIG.CONFIDENCE_BOOST_ID_MATCH;
      }
      if (placeholder.includes(keyword)) {
        confidence += FORM_DETECTION_CONFIG.CONFIDENCE_BOOST_PLACEHOLDER_MATCH;
      }
    }

    // 根据元素类型提升置信度
    if (type === 'email' && element.getAttribute('type') === 'email') {
      confidence += FORM_DETECTION_CONFIG.CONFIDENCE_BOOST_TYPE_MATCH;
    }
    if (type === 'website' && element.getAttribute('type') === 'url') {
      confidence += FORM_DETECTION_CONFIG.CONFIDENCE_BOOST_TYPE_MATCH;
    }
    if (type === 'comment' && element.tagName.toLowerCase() === 'textarea') {
      confidence += FORM_DETECTION_CONFIG.CONFIDENCE_BOOST_TYPE_MATCH;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 计算整体置信度
   */
  private calculateConfidence(fields: FormField[]): number {
    if (fields.length === 0) return 0;

    const weights = {
      comment: FORM_DETECTION_CONFIG.CONFIDENCE_WEIGHT_COMMENT,
      email: FORM_DETECTION_CONFIG.CONFIDENCE_WEIGHT_EMAIL,
      name: FORM_DETECTION_CONFIG.CONFIDENCE_WEIGHT_NAME,
      website: FORM_DETECTION_CONFIG.CONFIDENCE_WEIGHT_WEBSITE,
      submit: FORM_DETECTION_CONFIG.CONFIDENCE_WEIGHT_SUBMIT,
    };

    let totalConfidence = 0;
    let totalWeight = 0;

    for (const field of fields) {
      const weight = weights[field.type] || 0;
      totalConfidence += field.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalConfidence / totalWeight : 0;
  }

  /**
   * 查找匹配的模板
   */
  private async findMatchingTemplate(domain: string, path: string): Promise<SiteTemplate | null> {
    const templates = await templateStorage.getByDomainAndPageType(domain, PageType.BLOG_COMMENT);

    for (const template of templates) {
      if (this.matchPathPattern(path, template.path_pattern)) {
        return template;
      }
    }

    return null;
  }

  /**
   * 匹配路径模式
   * 防止 ReDoS 攻击
   */
  private matchPathPattern(path: string, pattern: string): boolean {
    // 1. 限制正则表达式长度
    if (pattern.length > FORM_DETECTION_CONFIG.REGEX_MAX_LENGTH) {
      logger.warn('Pattern 过长，跳过匹配', { pattern: pattern.substring(0, 50) + '...' });
      return false;
    }

    // 2. 限制通配符数量
    const wildcardCount = (pattern.match(/\*/g) || []).length;
    if (wildcardCount > FORM_DETECTION_CONFIG.REGEX_MAX_WILDCARDS) {
      logger.warn('Pattern 包含过多通配符，跳过匹配', { pattern, wildcardCount });
      return false;
    }

    // 3. 转义特殊字符，只允许 * 作为通配符
    const escapedPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
      .replace(/\*/g, '.*'); // 将 * 替换为 .*

    try {
      const regex = new RegExp('^' + escapedPattern + '$');
      return regex.test(path);
    } catch (error) {
      logger.error('正则表达式编译失败', error as Error, { pattern });
      return false;
    }
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

  /**
   * 启动动态表单监听
   */
  startObserving(callback?: (result: FormDetectionResult) => void): void {
    if (this.formObserver?.isRunning()) {
      logger.warn('表单监听器已在运行中');
      return;
    }

    // 保存回调
    if (callback) {
      this.onFormChangeCallback = callback;
    }

    // 创建监听器
    if (!this.formObserver) {
      this.formObserver = new FormObserver({
        debounceDelay: FORM_DETECTION_CONFIG.DEBOUNCE_DELAY,
        watchAttributes: true,
        watchSubtree: true,
      });
    }

    // 启动监听
    this.formObserver.start(async (addedForms, addedFields) => {
      logger.info('检测到表单变化', {
        forms: addedForms.length,
        fields: addedFields.length,
      });

      // 重新检测表单
      const result = await this.detect();

      // 触发回调
      if (this.onFormChangeCallback && result.detected) {
        this.onFormChangeCallback(result);
      }
    });

    logger.info('动态表单监听已启动');
  }

  /**
   * 停止动态表单监听
   */
  stopObserving(): void {
    if (this.formObserver) {
      this.formObserver.stop();
      logger.info('动态表单监听已停止');
    }
  }

  /**
   * 销毁检测器
   */
  destroy(): void {
    if (this.formObserver) {
      this.formObserver.destroy();
      this.formObserver = null;
    }
    this.onFormChangeCallback = null;
    logger.info('FormDetector 已销毁');
  }
}

/**
 * 导出单例
 */
export const formDetector = new FormDetector();
