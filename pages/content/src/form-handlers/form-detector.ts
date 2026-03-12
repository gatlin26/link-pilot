/**
 * 表单检测服务
 * 检测页面是否为博客评论页面，并识别表单字段
 */

import { templateStorage } from '@extension/storage';
import type { SiteTemplate, FieldMapping } from '@extension/shared';
import { PageType } from '@extension/shared';

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
  /** 表单元素（如果检测到） */
  formElement: HTMLFormElement | null;
  /** 使用的模板 */
  template: SiteTemplate | null;
  /** 整体置信度 */
  confidence: number;
}

/**
 * 表单检测器
 */
export class FormDetector {
  /**
   * 检测页面表单
   */
  async detect(): Promise<FormDetectionResult> {
    const domain = this.extractDomain(window.location.href);
    const path = window.location.pathname;

    // 尝试使用模板
    const template = await this.findMatchingTemplate(domain, path);
    if (template) {
      return this.detectWithTemplate(template);
    }

    // 使用启发式识别
    return this.detectWithHeuristics();
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

    // 查找表单元素
    const formElement = fields.length > 0
      ? fields[0].element.closest('form') as HTMLFormElement
      : null;

    return {
      detected,
      pageType: template.page_type,
      fields,
      formElement,
      template,
      confidence,
    };
  }

  /**
   * 使用启发式规则检测
   */
  private async detectWithHeuristics(): Promise<FormDetectionResult> {
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

    // 检测 comment 字段（扩展中英文关键词）
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

    // 判断是否为博客评论表单
    const hasComment = fields.some(f => f.type === 'comment');
    const hasNameOrEmail = fields.some(f => f.type === 'name' || f.type === 'email');
    const detected = hasComment && hasNameOrEmail;

    // 计算置信度
    const confidence = this.calculateConfidence(fields);

    // 查找表单元素
    const formElement = fields.length > 0
      ? fields[0].element.closest('form') as HTMLFormElement
      : null;

    return {
      detected,
      pageType: detected ? PageType.BLOG_COMMENT : null,
      fields,
      formElement,
      template: null,
      confidence,
    };
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
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetParent !== null
    );
  }

  /**
   * 生成稳定的选择器
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

      // 添加类名（最多 2 个）
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

      // 限制路径深度
      if (path.length >= 4) break;
    }

    return path.join(' > ');
  }

  /**
   * 计算字段置信度
   */
  private calculateFieldConfidence(element: HTMLElement, type: string): number {
    let confidence = 0.5; // 基础置信度

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
      if (name.includes(keyword)) confidence += 0.25;
      if (id.includes(keyword)) confidence += 0.15;
      if (placeholder.includes(keyword)) confidence += 0.1;
    }

    // 根据元素类型提升置信度
    if (type === 'email' && element.getAttribute('type') === 'email') confidence += 0.2;
    if (type === 'website' && element.getAttribute('type') === 'url') confidence += 0.2;
    if (type === 'comment' && element.tagName.toLowerCase() === 'textarea') confidence += 0.2;

    return Math.min(confidence, 1.0);
  }

  /**
   * 计算整体置信度
   */
  private calculateConfidence(fields: FormField[]): number {
    if (fields.length === 0) return 0;

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
   */
  private matchPathPattern(path: string, pattern: string): boolean {
    // 简单的通配符匹配
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(path);
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
export const formDetector = new FormDetector();
