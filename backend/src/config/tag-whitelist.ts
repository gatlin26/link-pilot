/**
 * 标签白名单配置
 *
 * 从 Toolify 的 400+ 标签中精选出 200 个以内的高质量标签
 * 用于 AI 自动打标签时的标签池限制
 *
 * 分类说明：
 * - type: 工具类型（40-50 个）
 * - pricing: 定价模式（10-15 个）
 * - platform: 平台类型（15-20 个）
 * - feature: 功能特性（80-100 个）
 * - general: 通用标签（20-30 个）
 */

export const TAG_WHITELIST = {
  // ============================================================================
  // 工具类型 (Type) - 45 个
  // ============================================================================
  type: [
    // AI 生成类
    'ai-image-generator',
    'ai-video-generator',
    'ai-text-generator',
    'ai-audio-generator',
    'ai-music-generator',
    'ai-voice-generator',
    'ai-avatar-generator',
    'ai-logo-generator',
    'ai-art-generator',

    // AI 助手类
    'ai-chatbot',
    'ai-writing-assistant',
    'ai-code-assistant',
    'ai-research-assistant',
    'ai-email-assistant',
    'ai-translation-tool',

    // 设计工具
    'design-tool',
    'graphic-design',
    'ui-design',
    'video-editor',
    'photo-editor',
    '3d-modeling',
    'animation-tool',

    // 开发工具
    'code-editor',
    'developer-tool',
    'api-tool',
    'testing-tool',
    'debugging-tool',
    'deployment-tool',

    // 营销工具
    'seo-tool',
    'analytics-tool',
    'social-media-tool',
    'email-marketing',
    'content-marketing',

    // 生产力工具
    'productivity-tool',
    'project-management',
    'task-management',
    'note-taking',
    'collaboration-tool',
    'automation-tool',

    // 其他专业工具
    'data-analysis',
    'crm-tool',
    'customer-support',
    'hr-tool',
    'finance-tool',
  ],

  // ============================================================================
  // 定价模式 (Pricing) - 12 个
  // ============================================================================
  pricing: [
    'free',
    'freemium',
    'paid',
    'subscription',
    'one-time-payment',
    'open-source',
    'free-trial',
    'pay-per-use',
    'enterprise',
    'lifetime-deal',
    'credit-based',
    'usage-based',
  ],

  // ============================================================================
  // 平台类型 (Platform) - 18 个
  // ============================================================================
  platform: [
    'web-app',
    'mobile-app',
    'desktop-app',
    'browser-extension',
    'api',
    'chrome-extension',
    'ios-app',
    'android-app',
    'mac-app',
    'windows-app',
    'linux-app',
    'wordpress-plugin',
    'figma-plugin',
    'vscode-extension',
    'slack-app',
    'discord-bot',
    'telegram-bot',
    'whatsapp-bot',
  ],

  // ============================================================================
  // 功能特性 (Feature) - 95 个
  // ============================================================================
  feature: [
    // AI 核心功能
    'text-to-image',
    'image-to-image',
    'text-to-video',
    'text-to-speech',
    'speech-to-text',
    'text-to-music',
    'image-to-video',
    'video-to-text',
    'ai-upscaling',
    'ai-enhancement',
    'background-removal',
    'face-swap',
    'voice-cloning',
    'lip-sync',

    // 内容创作
    'content-generation',
    'blog-writing',
    'copywriting',
    'article-writing',
    'social-media-content',
    'email-writing',
    'ad-copy',
    'product-description',
    'seo-content',
    'script-writing',
    'story-writing',

    // 代码相关
    'code-generation',
    'code-completion',
    'code-review',
    'bug-detection',
    'code-refactoring',
    'documentation-generation',
    'unit-testing',

    // 设计功能
    'logo-design',
    // 'ui-design', // 已在 type 类别中
    'mockup-generation',
    'color-palette',
    'font-pairing',
    'icon-generation',
    'illustration',
    'infographic',

    // 视频功能
    'video-editing',
    'video-generation',
    'video-transcription',
    'subtitle-generation',
    'video-translation',
    'video-compression',
    'screen-recording',

    // 图像功能
    'image-editing',
    'photo-enhancement',
    'image-compression',
    'image-resizing',
    'watermark-removal',
    'object-removal',
    'style-transfer',

    // 音频功能
    'audio-editing',
    'music-generation',
    'podcast-editing',
    'noise-reduction',
    'audio-transcription',
    'voice-over',

    // 数据处理
    'data-visualization',
    'data-extraction',
    'data-cleaning',
    // 'data-analysis', // 已在 type 类别中
    'report-generation',
    'chart-generation',

    // 营销功能
    'keyword-research',
    'competitor-analysis',
    'backlink-analysis',
    'rank-tracking',
    'social-media-scheduling',
    'influencer-discovery',
    'email-automation',
    'landing-page-builder',

    // 协作功能
    'real-time-collaboration',
    'team-chat',
    'file-sharing',
    'version-control',
    'comment-system',
    'task-assignment',

    // 技术特性
    'no-code',
    'low-code',
    'api-access',
    'webhook',
    'integration',
    'batch-processing',
    'real-time-processing',
    'cloud-storage',
    'offline-mode',
    'multi-language',
    'custom-branding',
    'white-label',
  ],

  // ============================================================================
  // 通用标签 (General) - 25 个
  // ============================================================================
  general: [
    // 行业领域
    'business',
    'education',
    'healthcare',
    'finance',
    'e-commerce',
    'real-estate',
    'legal',
    'entertainment',
    'gaming',
    'travel',

    // 用途场景
    'productivity',
    'creativity',
    'communication',
    'learning',
    'research',
    'sales',
    'customer-service',
    'hr',
    'recruiting',

    // 目标用户
    'for-developers',
    'for-designers',
    'for-marketers',
    'for-writers',
    'for-students',
    'for-teams',
  ],
} as const;

// ============================================================================
// 配置常量
// ============================================================================

/**
 * 每个工具的最大标签数量
 */
export const MAX_TAGS_PER_TOOL = 10;

/**
 * 每个工具的最小标签数量
 */
export const MIN_TAGS_PER_TOOL = 5;

/**
 * 标签发布的最小工具数量阈值
 * 工具数 < 5: status='draft', 不对外展示（返回 404）
 * 工具数 >= 5: status='published', 正常发布
 */
export const MIN_TOOLS_FOR_PUBLISH = 5;

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取所有白名单标签（扁平化数组）
 */
export function getAllWhitelistTags(): string[] {
  return [
    ...TAG_WHITELIST.type,
    ...TAG_WHITELIST.pricing,
    ...TAG_WHITELIST.platform,
    ...TAG_WHITELIST.feature,
    ...TAG_WHITELIST.general,
  ];
}

/**
 * 检查标签是否在白名单中
 */
export function isTagInWhitelist(slug: string): boolean {
  return getAllWhitelistTags().includes(slug);
}

/**
 * 获取标签的分类
 */
export function getTagCategory(slug: string): keyof typeof TAG_WHITELIST | null {
  for (const [category, tags] of Object.entries(TAG_WHITELIST)) {
    if (tags.includes(slug as never)) {
      return category as keyof typeof TAG_WHITELIST;
    }
  }
  return null;
}

/**
 * 获取白名单统计信息
 */
export function getWhitelistStats() {
  return {
    type: TAG_WHITELIST.type.length,
    pricing: TAG_WHITELIST.pricing.length,
    platform: TAG_WHITELIST.platform.length,
    feature: TAG_WHITELIST.feature.length,
    general: TAG_WHITELIST.general.length,
    total: getAllWhitelistTags().length,
  };
}
