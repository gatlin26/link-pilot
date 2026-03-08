/**
 * 评分服务实现
 */

import type { ScoringService } from '../interfaces/services.js';
import { LinkType, BusinessType } from '../types/enums.js';
import {
  calculateTotalScore,
  generateScoreNote,
  calculateLinkTypeScore,
  calculateBusinessTypeScore,
  calculateDomainRatingScore,
  calculateContentRelevanceScore,
} from '../rules/scoring-rules.js';

export class ScoringServiceImpl implements ScoringService {
  /**
   * 计算上下文匹配分数
   */
  calculateContextMatchScore(
    linkType: LinkType,
    businessTypes: BusinessType[],
    domainAuthority?: number,
    contentRelevance?: number,
  ): number {
    // 如果提供了自定义的内容相关性分数，使用它
    // 否则使用默认计算
    if (contentRelevance !== undefined) {
      const linkTypeScore = calculateLinkTypeScore(linkType);
      const businessTypeScore = calculateBusinessTypeScore(businessTypes);
      const domainRatingScore = calculateDomainRatingScore(domainAuthority);
      return linkTypeScore + businessTypeScore + domainRatingScore + contentRelevance;
    }

    return calculateTotalScore(linkType, businessTypes, domainAuthority);
  }

  /**
   * 生成评分说明
   */
  generateScoreNote(linkType: LinkType, businessTypes: BusinessType[], score: number): string {
    return generateScoreNote(linkType, businessTypes, score);
  }
}

export const scoringService = new ScoringServiceImpl();
