/**
 * 机会转换服务实现
 */

import type { OpportunityConverterService } from '../interfaces/services.js';
import type { CollectedBacklink, Opportunity } from '../types/models.js';
import { OpportunityStatus, PageType, LinkType } from '../types/enums.js';
import { canConvertToOpportunity, generateConversionReason } from '../rules/opportunity-rules.js';

export class OpportunityConverterServiceImpl implements OpportunityConverterService {
  /**
   * 转换为机会
   */
  async convert(backlink: CollectedBacklink): Promise<Opportunity> {
    if (!this.canConvert(backlink)) {
      throw new Error(`外链 ${backlink.id} 不符合转换规则`);
    }

    return this.createOpportunity(backlink, false, '');
  }

  /**
   * 批量转换
   */
  async convertBatch(backlinks: CollectedBacklink[]): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    for (const backlink of backlinks) {
      if (this.canConvert(backlink)) {
        try {
          const opportunity = await this.convert(backlink);
          opportunities.push(opportunity);
        } catch (error) {
          console.error(`转换失败: ${backlink.id}`, error);
        }
      }
    }

    return opportunities;
  }

  /**
   * 检查是否符合转换规则
   */
  canConvert(backlink: CollectedBacklink): boolean {
    // 必须有识别字段
    if (!backlink.link_type || !backlink.context_match_score) {
      return false;
    }

    // 必须是已同步或已审核状态
    if (backlink.status !== 'synced' && backlink.status !== 'reviewed') {
      return false;
    }

    // 检查准入规则
    return canConvertToOpportunity(backlink.link_type, backlink.context_match_score);
  }

  /**
   * 强制转换（人工）
   */
  async forceConvert(backlink: CollectedBacklink, reason: string): Promise<Opportunity> {
    return this.createOpportunity(backlink, true, reason);
  }

  /**
   * 创建机会对象
   */
  private createOpportunity(
    backlink: CollectedBacklink,
    isManual: boolean,
    manualReason: string,
  ): Opportunity {
    const now = new Date().toISOString();

    // 提取路径模式
    const pathPattern = this.extractPathPattern(backlink.referring_page_url);

    // 推断页面类型
    const pageType = this.inferPageType(backlink.link_type);

    // 生成转换原因
    const conversionReason = isManual
      ? manualReason
      : generateConversionReason(
          backlink.link_type!,
          backlink.context_match_score!,
          false,
        );

    const opportunity: Opportunity = {
      id: crypto.randomUUID(),
      collected_backlink_id: backlink.id,
      url: backlink.referring_page_url,
      domain: backlink.referring_domain,
      page_type: pageType,
      path_pattern: pathPattern,
      link_type: backlink.link_type!,
      site_summary: backlink.site_summary || '',
      site_business_types: backlink.site_business_types || [],
      context_match_score: backlink.context_match_score!,
      context_match_note: backlink.context_match_note || '',
      can_submit: true,
      can_auto_fill: backlink.link_type === LinkType.BLOG_COMMENT,
      can_auto_submit: false, // V1 默认不自动提交
      status: OpportunityStatus.NEW,
      notes: conversionReason,
      created_at: now,
      updated_at: now,
    };

    return opportunity;
  }

  /**
   * 提取路径模式
   */
  private extractPathPattern(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // 移除具体的 ID 和数字
      const pattern = path
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[a-f0-9]{8,}/g, '/:hash')
        .replace(/\/$/, '');

      return pattern || '/';
    } catch {
      return '/';
    }
  }

  /**
   * 推断页面类型
   */
  private inferPageType(linkType?: LinkType): PageType {
    if (!linkType) {
      return PageType.UNKNOWN;
    }

    switch (linkType) {
      case LinkType.BLOG_COMMENT:
        return PageType.BLOG_POST;
      case LinkType.GUEST_POST:
        return PageType.ARTICLE;
      case LinkType.FORUM:
        return PageType.FORUM_THREAD;
      case LinkType.DIRECTORY:
        return PageType.DIRECTORY_LISTING;
      case LinkType.RESOURCE_PAGE:
        return PageType.RESOURCE_LIST;
      default:
        return PageType.UNKNOWN;
    }
  }
}

export const opportunityConverterService = new OpportunityConverterServiceImpl();
