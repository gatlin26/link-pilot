/**
 * 字段类型映射工具
 * 将 FieldPurpose 映射到 link-pilot 的字段类型
 *
 * @author yiangto
 * @date 2026-03-13
 */

import type { FieldPurpose, FieldMetadata } from '../types/field-analyzer';
import { FORM_DETECTION_CONFIG } from '../config/constants';
import { logger } from '@extension/shared';

/**
 * link-pilot 支持的字段类型
 */
export type LinkPilotFieldType = 'name' | 'email' | 'website' | 'comment' | 'submit';

/**
 * 将 FieldPurpose 映射到 link-pilot 字段类型
 *
 * @param purpose - 字段用途
 * @param metadata - 字段元数据（用于更精确的判断）
 * @returns link-pilot 字段类型或 null（如果无法映射）
 */
export function mapFieldPurposeToLinkPilot(
  purpose: FieldPurpose,
  metadata: FieldMetadata,
): LinkPilotFieldType | null {
  // 直接映射
  switch (purpose) {
    case 'name':
      return 'name';
    case 'email':
      return 'email';
    case 'phone':
    case 'address':
    case 'city':
    case 'state':
    case 'zip':
    case 'country':
    case 'company':
    case 'title':
      // 这些字段类型在博客评论表单中不常见
      // 记录日志以便未来扩展
      logger.debug(`字段类型 ${purpose} 暂不支持，将尝试通过其他方式识别`, {
        purpose,
        labels: [
          metadata.labelTag,
          metadata.labelAria,
          metadata.labelLeft,
          metadata.labelTop,
        ].filter(Boolean),
      });
      // 不要直接返回 null，继续后续的启发式识别
      break;
    default:
      break;
  }

  // 对于 unknown 类型或不支持的类型，尝试通过其他信息推断
  if (purpose === 'unknown' || purpose === 'phone' || purpose === 'address' ||
      purpose === 'city' || purpose === 'state' || purpose === 'zip' ||
      purpose === 'country' || purpose === 'company' || purpose === 'title') {
    return inferFromMetadata(metadata);
  }

  // 其他类型暂不支持
  return null;
}

/**
 * 从元数据推断字段类型
 * 用于处理 purpose 为 unknown 的情况
 *
 * @param metadata - 字段元数据
 * @returns link-pilot 字段类型或 null
 */
function inferFromMetadata(metadata: FieldMetadata): LinkPilotFieldType | null {
  // 检查是否为评论字段
  if (isCommentField(metadata)) {
    return 'comment';
  }

  // 检查是否为网站字段
  if (isWebsiteField(metadata)) {
    return 'website';
  }

  // 检查是否为提交按钮
  if (isSubmitButton(metadata)) {
    return 'submit';
  }

  return null;
}

/**
 * 辅助函数：检查文本是否包含任意关键词
 */
function containsAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * 判断是否为评论字段
 */
function isCommentField(metadata: FieldMetadata): boolean {
  // textarea 类型通常是评论
  if (metadata.fieldType === 'textarea') {
    return true;
  }

  // 检查所有标签文本
  const allLabels = [
    metadata.labelTag,
    metadata.labelAria,
    metadata.labelData,
    metadata.labelLeft,
    metadata.labelTop,
    metadata.placeholder,
    metadata.name,
    metadata.id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 评论相关关键词
  const commentKeywords = [
    'comment', 'message', 'content', 'text', 'body',
    '评论', '留言', '内容', '消息',
  ];

  return containsAnyKeyword(allLabels, commentKeywords);
}

/**
 * 判断是否为网站字段
 */
function isWebsiteField(metadata: FieldMetadata): boolean {
  // URL 类型
  if (metadata.fieldType === 'url') {
    return true;
  }

  // 检查 autocomplete 属性
  if (metadata.autocomplete?.toLowerCase() === 'url') {
    return true;
  }

  // 检查所有标签文本
  const allLabels = [
    metadata.labelTag,
    metadata.labelAria,
    metadata.labelData,
    metadata.labelLeft,
    metadata.labelTop,
    metadata.placeholder,
    metadata.name,
    metadata.id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 网站相关关键词
  const websiteKeywords = [
    'website', 'site', 'url', 'homepage', 'web',
    '网站', '网址', '主页',
  ];

  return containsAnyKeyword(allLabels, websiteKeywords);
}

/**
 * 判断是否为提交按钮
 */
function isSubmitButton(metadata: FieldMetadata): boolean {
  // 检查 type 属性
  if (metadata.type === 'submit' || metadata.type === 'button') {
    // 检查标签文本
    const allLabels = [
      metadata.labelTag,
      metadata.labelAria,
      metadata.placeholder,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const submitKeywords = [
      'submit', 'send', 'post', 'publish', 'save',
      '提交', '发送', '发表', '保存',
    ];

    return containsAnyKeyword(allLabels, submitKeywords);
  }

  return false;
}

/**
 * 计算字段质量分数
 * 用于过滤低质量字段
 *
 * @param metadata - 字段元数据
 * @returns 质量分数 (0-1)
 */
export function calculateFieldQuality(metadata: FieldMetadata): number {
  let score = 0;

  // 有明确标签
  if (metadata.labelTag || metadata.labelAria) {
    score += FORM_DETECTION_CONFIG.QUALITY_SCORE_LABEL_TAG;
  }

  // 有位置标签
  if (metadata.labelLeft || metadata.labelTop) {
    score += FORM_DETECTION_CONFIG.QUALITY_SCORE_POSITIONAL_LABEL;
  }

  // 有 placeholder
  if (metadata.placeholder) {
    score += FORM_DETECTION_CONFIG.QUALITY_SCORE_PLACEHOLDER;
  }

  // 可见且可交互
  if (metadata.isVisible && metadata.isInteractive) {
    score += FORM_DETECTION_CONFIG.QUALITY_SCORE_VISIBLE_INTERACTIVE;
  }

  // 在最上层
  if (metadata.isTopElement) {
    score += FORM_DETECTION_CONFIG.QUALITY_SCORE_TOP_ELEMENT;
  }

  return Math.min(score, 1.0);
}
