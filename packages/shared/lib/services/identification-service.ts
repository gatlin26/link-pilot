/**
 * 识别服务实现
 */

import type { IdentificationService, IdentificationResult } from '../interfaces/services.js';
import type { CollectedBacklink } from '../types/models.js';
import { identifyLinkType } from '../rules/link-type-rules.js';
import { businessTypeDetectorService } from './business-type-detector.js';
import { scoringService } from './scoring-service.js';

export class IdentificationServiceImpl implements IdentificationService {
  /**
   * 识别外链
   */
  async identify(backlink: CollectedBacklink): Promise<IdentificationResult> {
    // 识别 Link Type
    const linkType = identifyLinkType(
      backlink.referring_page_url,
      backlink.page_title,
      backlink.anchor_text,
    );

    // 识别 Business Type
    const businessTypes = businessTypeDetectorService.detect(
      backlink.referring_page_url,
      backlink.page_title,
      backlink.anchor_text,
    );

    // 提取域名评分（如果有）
    const domainRating = (
      backlink.raw_metrics?.domain_rating ?? backlink.raw_metrics?.domainRating ?? backlink.raw_metrics?.dr
    ) as number | undefined;

    // 计算上下文匹配分数
    const contextMatchScore = scoringService.calculateContextMatchScore(
      linkType,
      businessTypes,
      domainRating,
    );

    // 生成评分说明
    const contextMatchNote = scoringService.generateScoreNote(linkType, businessTypes, contextMatchScore);

    // 生成站点摘要
    const siteSummary = this.generateSiteSummary(backlink, linkType, businessTypes);

    return {
      link_type: linkType,
      site_business_types: businessTypes,
      context_match_score: contextMatchScore,
      context_match_note: contextMatchNote,
      site_summary: siteSummary,
    };
  }

  /**
   * 批量识别
   */
  async identifyBatch(backlinks: CollectedBacklink[]): Promise<IdentificationResult[]> {
    const results: IdentificationResult[] = [];

    for (const backlink of backlinks) {
      try {
        const result = await this.identify(backlink);
        results.push(result);
      } catch (error) {
        console.error(`识别失败: ${backlink.id}`, error);
        // 返回默认结果
        results.push({
          link_type: 'unknown' as any,
          site_business_types: ['other' as any],
          context_match_score: 0,
          context_match_note: '识别失败',
          site_summary: '无法识别',
        });
      }
    }

    return results;
  }

  /**
   * 生成站点摘要
   */
  private generateSiteSummary(
    backlink: CollectedBacklink,
    linkType: string,
    businessTypes: string[],
  ): string {
    const domain = backlink.referring_domain;
    const typeStr = linkType.replace(/_/g, ' ');
    const businessStr = businessTypes
      .filter(t => t !== 'other')
      .map(t => t.replace(/_/g, ' '))
      .join(', ');

    if (businessStr) {
      return `${domain} - ${typeStr} 类型，专注于 ${businessStr}`;
    } else {
      return `${domain} - ${typeStr} 类型`;
    }
  }
}

export const identificationService = new IdentificationServiceImpl();
