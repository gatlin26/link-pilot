/**
 * 工具类型和分类配置
 * 用于 AI 分析和表单建议
 */

/**
 * 工具类型建议列表
 * 类型表示工具的主要用途
 */
export const TOOL_TYPES_SUGGESTIONS = [
  'AI Tool',
  'Developer Tool',
  'Design Tool',
  'Marketing Tool',
  'Productivity Tool',
  'Business Tool',
  'Education Tool',
  'Analytics Tool',
  'Communication Tool',
  'Other',
] as const;

/**
 * 工具分类建议列表
 * 分类表示具体的功能领域
 */
export const TOOL_CATEGORIES_SUGGESTIONS = [
  'AI Chat',
  'Image Generation',
  'Video Generation',
  'Audio & Music',
  'Writing & Content',
  'Code & Development',
  'Productivity',
  'Marketing',
  'Design',
  'Education',
  'Business',
  'Research',
  'Data Analysis',
  'Automation',
  'Customer Service',
  'SEO',
  'Social Media',
  'E-commerce',
  'Other AI Tools',
] as const;

/**
 * 工具标签建议列表
 * 标签表示工具的特性
 */
export const TOOL_TAGS_SUGGESTIONS = [
  'Free',
  'Freemium',
  'Paid',
  'Open Source',
  'API Available',
  'No Code',
  'Mobile App',
  'Browser Extension',
  'Self-hosted',
  'Cloud-based',
  'Real-time',
  'Collaborative',
  'Enterprise',
] as const;

export type ToolTypeSuggestion = (typeof TOOL_TYPES_SUGGESTIONS)[number];
export type ToolCategorySuggestion =
  (typeof TOOL_CATEGORIES_SUGGESTIONS)[number];
export type ToolTagSuggestion = (typeof TOOL_TAGS_SUGGESTIONS)[number];
