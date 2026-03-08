/**
 * 机会转换规则
 */

import { LinkType } from '../types/enums.js';
import { OPPORTUNITY_ADMISSION_RULES } from './business-rules.js';

/**
 * 检查是否符合机会池准入规则
 */
export function canConvertToOpportunity(
  linkType: LinkType,
  contextMatchScore: number,
): boolean {
  // 必须是支持的链接类型
  if (linkType !== OPPORTUNITY_ADMISSION_RULES.requiredLinkType) {
    return false;
  }

  // 必须达到最低分数
  if (contextMatchScore < OPPORTUNITY_ADMISSION_RULES.minContextMatchScore) {
    return false;
  }

  return true;
}

/**
 * 生成转换原因说明
 */
export function generateConversionReason(
  linkType: LinkType,
  contextMatchScore: number,
  isManual: boolean,
): string {
  if (isManual) {
    return '人工强制转换';
  }

  const reasons: string[] = [];

  if (linkType === LinkType.BLOG_COMMENT) {
    reasons.push('博客评论类型（V1 支持）');
  }

  if (contextMatchScore >= 80) {
    reasons.push('高质量匹配');
  } else if (contextMatchScore >= 60) {
    reasons.push('中等质量匹配');
  }

  return reasons.join('，');
}
