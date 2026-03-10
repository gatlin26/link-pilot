/**
 * @file tag-quality.ts
 * @description 标签质量规则与治理策略
 */

export const TAG_QUALITY_RULES = {
  /** 最小工具数（发布门槛） */
  MIN_TOOLS_TO_PUBLISH: 3,
  /** 最小工具数（索引门槛） */
  MIN_TOOLS_TO_INDEX: 3,
  /** 最小描述长度 */
  MIN_DESCRIPTION_LENGTH: 50,
  /** 推荐 content 长度 */
  RECOMMENDED_CONTENT_LENGTH: 150,
};

export interface TagSEOStatus {
  status: 'draft' | 'published';
  robots: 'noindex, nofollow' | 'noindex, follow' | 'index, follow';
  message: string;
}

/**
 * 根据工具数和描述质量判断标签的 SEO 状态
 */
export function getTagSEOStatus(
  toolCount: number,
  hasDescription: boolean
): TagSEOStatus {
  // 工具数不足发布门槛
  if (toolCount < TAG_QUALITY_RULES.MIN_TOOLS_TO_PUBLISH) {
    return {
      status: 'draft',
      robots: 'noindex, nofollow',
      message: 'Not enough tools to publish',
    };
  }

  // 工具数不足索引门槛（薄内容）
  if (toolCount < TAG_QUALITY_RULES.MIN_TOOLS_TO_INDEX) {
    return {
      status: 'published',
      robots: 'noindex, follow',
      message: 'Published but not indexed (thin content)',
    };
  }

  // 正常发布并索引
  return {
    status: 'published',
    robots: 'index, follow',
    message: 'Fully published and indexed',
  };
}

/**
 * 判断标签是否为薄内容
 */
export function isThinContent(toolCount: number): boolean {
  return toolCount < TAG_QUALITY_RULES.MIN_TOOLS_TO_INDEX;
}

/**
 * 判断标签是否需要警告提示
 */
export function needsWarning(toolCount: number): boolean {
  return toolCount < 5;
}
