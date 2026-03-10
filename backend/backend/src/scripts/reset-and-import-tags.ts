/**
 * 清空标签表并重新导入白名单标签
 *
 * 步骤：
 * 1. 清空 tool_tag_translations 表（翻译表）
 * 2. 清空 tool_tags 表（主表）
 * 3. 从白名单导入所有标签
 * 4. 为每个标签创建英文和中文翻译
 *
 * 使用方法：
 * pnpm tsx src/scripts/reset-and-import-tags.ts
 */

import '../lib/env-loader';
import { db } from '../db/index';
import { toolTags, toolTagTranslations } from '@/db/schema';
import { TAG_WHITELIST } from '@/config/tag-whitelist';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// 标签名称映射（slug -> 英文名称和中文名称）
const TAG_NAMES: Record<string, { en: string; zh: string; description?: { en: string; zh: string } }> = {
  // ============================================================================
  // Type (工具类型)
  // ============================================================================
  'ai-image-generator': { en: 'AI Image Generator', zh: 'AI 图像生成器' },
  'ai-video-generator': { en: 'AI Video Generator', zh: 'AI 视频生成器' },
  'ai-text-generator': { en: 'AI Text Generator', zh: 'AI 文本生成器' },
  'ai-audio-generator': { en: 'AI Audio Generator', zh: 'AI 音频生成器' },
  'ai-music-generator': { en: 'AI Music Generator', zh: 'AI 音乐生成器' },
  'ai-voice-generator': { en: 'AI Voice Generator', zh: 'AI 语音生成器' },
  'ai-avatar-generator': { en: 'AI Avatar Generator', zh: 'AI 头像生成器' },
  'ai-logo-generator': { en: 'AI Logo Generator', zh: 'AI Logo 生成器' },
  'ai-art-generator': { en: 'AI Art Generator', zh: 'AI 艺术生成器' },
  'ai-chatbot': { en: 'AI Chatbot', zh: 'AI 聊天机器人' },
  'ai-writing-assistant': { en: 'AI Writing Assistant', zh: 'AI 写作助手' },
  'ai-code-assistant': { en: 'AI Code Assistant', zh: 'AI 代码助手' },
  'ai-research-assistant': { en: 'AI Research Assistant', zh: 'AI 研究助手' },
  'ai-email-assistant': { en: 'AI Email Assistant', zh: 'AI 邮件助手' },
  'ai-translation-tool': { en: 'AI Translation Tool', zh: 'AI 翻译工具' },
  'design-tool': { en: 'Design Tool', zh: '设计工具' },
  'graphic-design': { en: 'Graphic Design', zh: '平面设计' },
  'ui-design': { en: 'UI Design', zh: 'UI 设计' },
  'video-editor': { en: 'Video Editor', zh: '视频编辑器' },
  'photo-editor': { en: 'Photo Editor', zh: '图片编辑器' },
  '3d-modeling': { en: '3D Modeling', zh: '3D 建模' },
  'animation-tool': { en: 'Animation Tool', zh: '动画工具' },
  'code-editor': { en: 'Code Editor', zh: '代码编辑器' },
  'developer-tool': { en: 'Developer Tool', zh: '开发工具' },
  'api-tool': { en: 'API Tool', zh: 'API 工具' },
  'testing-tool': { en: 'Testing Tool', zh: '测试工具' },
  'debugging-tool': { en: 'Debugging Tool', zh: '调试工具' },
  'deployment-tool': { en: 'Deployment Tool', zh: '部署工具' },
  'seo-tool': { en: 'SEO Tool', zh: 'SEO 工具' },
  'analytics-tool': { en: 'Analytics Tool', zh: '分析工具' },
  'social-media-tool': { en: 'Social Media Tool', zh: '社交媒体工具' },
  'email-marketing': { en: 'Email Marketing', zh: '邮件营销' },
  'content-marketing': { en: 'Content Marketing', zh: '内容营销' },
  'productivity-tool': { en: 'Productivity Tool', zh: '生产力工具' },
  'project-management': { en: 'Project Management', zh: '项目管理' },
  'task-management': { en: 'Task Management', zh: '任务管理' },
  'note-taking': { en: 'Note Taking', zh: '笔记工具' },
  'collaboration-tool': { en: 'Collaboration Tool', zh: '协作工具' },
  'automation-tool': { en: 'Automation Tool', zh: '自动化工具' },
  'data-analysis': { en: 'Data Analysis', zh: '数据分析' },
  'crm-tool': { en: 'CRM Tool', zh: 'CRM 工具' },
  'customer-support': { en: 'Customer Support', zh: '客户支持' },
  'hr-tool': { en: 'HR Tool', zh: '人力资源工具' },
  'finance-tool': { en: 'Finance Tool', zh: '财务工具' },

  // ============================================================================
  // Pricing (定价模式)
  // ============================================================================
  'free': { en: 'Free', zh: '免费' },
  'freemium': { en: 'Freemium', zh: '免费增值' },
  'paid': { en: 'Paid', zh: '付费' },
  'subscription': { en: 'Subscription', zh: '订阅制' },
  'one-time-payment': { en: 'One-time Payment', zh: '一次性付费' },
  'open-source': { en: 'Open Source', zh: '开源' },
  'free-trial': { en: 'Free Trial', zh: '免费试用' },
  'pay-per-use': { en: 'Pay Per Use', zh: '按使用付费' },
  'enterprise': { en: 'Enterprise', zh: '企业版' },
  'lifetime-deal': { en: 'Lifetime Deal', zh: '终身优惠' },
  'credit-based': { en: 'Credit Based', zh: '积分制' },
  'usage-based': { en: 'Usage Based', zh: '用量计费' },

  // ============================================================================
  // Platform (平台类型)
  // ============================================================================
  'web-app': { en: 'Web App', zh: '网页应用' },
  'mobile-app': { en: 'Mobile App', zh: '移动应用' },
  'desktop-app': { en: 'Desktop App', zh: '桌面应用' },
  'browser-extension': { en: 'Browser Extension', zh: '浏览器扩展' },
  'api': { en: 'API', zh: 'API' },
  'chrome-extension': { en: 'Chrome Extension', zh: 'Chrome 扩展' },
  'ios-app': { en: 'iOS App', zh: 'iOS 应用' },
  'android-app': { en: 'Android App', zh: 'Android 应用' },
  'mac-app': { en: 'Mac App', zh: 'Mac 应用' },
  'windows-app': { en: 'Windows App', zh: 'Windows 应用' },
  'linux-app': { en: 'Linux App', zh: 'Linux 应用' },
  'wordpress-plugin': { en: 'WordPress Plugin', zh: 'WordPress 插件' },
  'figma-plugin': { en: 'Figma Plugin', zh: 'Figma 插件' },
  'vscode-extension': { en: 'VSCode Extension', zh: 'VSCode 扩展' },
  'slack-app': { en: 'Slack App', zh: 'Slack 应用' },
  'discord-bot': { en: 'Discord Bot', zh: 'Discord 机器人' },
  'telegram-bot': { en: 'Telegram Bot', zh: 'Telegram 机器人' },
  'whatsapp-bot': { en: 'WhatsApp Bot', zh: 'WhatsApp 机器人' },

  // ============================================================================
  // Feature (功能特性) - 部分示例，完整列表较长
  // ============================================================================
  'text-to-image': { en: 'Text to Image', zh: '文本生成图像' },
  'image-to-image': { en: 'Image to Image', zh: '图像转图像' },
  'text-to-video': { en: 'Text to Video', zh: '文本生成视频' },
  'text-to-speech': { en: 'Text to Speech', zh: '文本转语音' },
  'speech-to-text': { en: 'Speech to Text', zh: '语音转文本' },
  'text-to-music': { en: 'Text to Music', zh: '文本生成音乐' },
  'image-to-video': { en: 'Image to Video', zh: '图像生成视频' },
  'video-to-text': { en: 'Video to Text', zh: '视频转文本' },
  'ai-upscaling': { en: 'AI Upscaling', zh: 'AI 放大' },
  'ai-enhancement': { en: 'AI Enhancement', zh: 'AI 增强' },
  'background-removal': { en: 'Background Removal', zh: '背景移除' },
  'face-swap': { en: 'Face Swap', zh: '换脸' },
  'voice-cloning': { en: 'Voice Cloning', zh: '语音克隆' },
  'lip-sync': { en: 'Lip Sync', zh: '唇形同步' },
  'content-generation': { en: 'Content Generation', zh: '内容生成' },
  'blog-writing': { en: 'Blog Writing', zh: '博客写作' },
  'copywriting': { en: 'Copywriting', zh: '文案写作' },
  'article-writing': { en: 'Article Writing', zh: '文章写作' },
  'social-media-content': { en: 'Social Media Content', zh: '社交媒体内容' },
  'email-writing': { en: 'Email Writing', zh: '邮件写作' },
  'ad-copy': { en: 'Ad Copy', zh: '广告文案' },
  'product-description': { en: 'Product Description', zh: '产品描述' },
  'seo-content': { en: 'SEO Content', zh: 'SEO 内容' },
  'script-writing': { en: 'Script Writing', zh: '脚本写作' },
  'story-writing': { en: 'Story Writing', zh: '故事写作' },
  'code-generation': { en: 'Code Generation', zh: '代码生成' },
  'code-completion': { en: 'Code Completion', zh: '代码补全' },
  'code-review': { en: 'Code Review', zh: '代码审查' },
  'bug-detection': { en: 'Bug Detection', zh: 'Bug 检测' },
  'code-refactoring': { en: 'Code Refactoring', zh: '代码重构' },
  'documentation-generation': { en: 'Documentation Generation', zh: '文档生成' },
  'unit-testing': { en: 'Unit Testing', zh: '单元测试' },
  'logo-design': { en: 'Logo Design', zh: 'Logo 设计' },
  'ui-design': { en: 'UI Design', zh: 'UI 设计' },
  'mockup-generation': { en: 'Mockup Generation', zh: '原型生成' },
  'color-palette': { en: 'Color Palette', zh: '配色方案' },
  'font-pairing': { en: 'Font Pairing', zh: '字体搭配' },
  'icon-generation': { en: 'Icon Generation', zh: '图标生成' },
  'illustration': { en: 'Illustration', zh: '插画' },
  'infographic': { en: 'Infographic', zh: '信息图表' },
  'video-editing': { en: 'Video Editing', zh: '视频编辑' },
  'video-generation': { en: 'Video Generation', zh: '视频生成' },
  'video-transcription': { en: 'Video Transcription', zh: '视频转录' },
  'subtitle-generation': { en: 'Subtitle Generation', zh: '字幕生成' },
  'video-translation': { en: 'Video Translation', zh: '视频翻译' },
  'video-compression': { en: 'Video Compression', zh: '视频压缩' },
  'screen-recording': { en: 'Screen Recording', zh: '屏幕录制' },
  'image-editing': { en: 'Image Editing', zh: '图像编辑' },
  'photo-enhancement': { en: 'Photo Enhancement', zh: '照片增强' },
  'image-compression': { en: 'Image Compression', zh: '图像压缩' },
  'image-resizing': { en: 'Image Resizing', zh: '图像调整大小' },
  'watermark-removal': { en: 'Watermark Removal', zh: '水印移除' },
  'object-removal': { en: 'Object Removal', zh: '物体移除' },
  'style-transfer': { en: 'Style Transfer', zh: '风格迁移' },
  'audio-editing': { en: 'Audio Editing', zh: '音频编辑' },
  'music-generation': { en: 'Music Generation', zh: '音乐生成' },
  'podcast-editing': { en: 'Podcast Editing', zh: '播客编辑' },
  'noise-reduction': { en: 'Noise Reduction', zh: '降噪' },
  'audio-transcription': { en: 'Audio Transcription', zh: '音频转录' },
  'voice-over': { en: 'Voice Over', zh: '配音' },
  'data-visualization': { en: 'Data Visualization', zh: '数据可视化' },
  'data-extraction': { en: 'Data Extraction', zh: '数据提取' },
  'data-cleaning': { en: 'Data Cleaning', zh: '数据清洗' },
  'data-analysis': { en: 'Data Analysis', zh: '数据分析' },
  'report-generation': { en: 'Report Generation', zh: '报告生成' },
  'chart-generation': { en: 'Chart Generation', zh: '图表生成' },
  'keyword-research': { en: 'Keyword Research', zh: '关键词研究' },
  'competitor-analysis': { en: 'Competitor Analysis', zh: '竞争对手分析' },
  'backlink-analysis': { en: 'Backlink Analysis', zh: '反向链接分析' },
  'rank-tracking': { en: 'Rank Tracking', zh: '排名跟踪' },
  'social-media-scheduling': { en: 'Social Media Scheduling', zh: '社交媒体排期' },
  'influencer-discovery': { en: 'Influencer Discovery', zh: '网红发现' },
  'email-automation': { en: 'Email Automation', zh: '邮件自动化' },
  'landing-page-builder': { en: 'Landing Page Builder', zh: '落地页构建器' },
  'real-time-collaboration': { en: 'Real-time Collaboration', zh: '实时协作' },
  'team-chat': { en: 'Team Chat', zh: '团队聊天' },
  'file-sharing': { en: 'File Sharing', zh: '文件共享' },
  'version-control': { en: 'Version Control', zh: '版本控制' },
  'comment-system': { en: 'Comment System', zh: '评论系统' },
  'task-assignment': { en: 'Task Assignment', zh: '任务分配' },
  'no-code': { en: 'No Code', zh: '无代码' },
  'low-code': { en: 'Low Code', zh: '低代码' },
  'api-access': { en: 'API Access', zh: 'API 访问' },
  'webhook': { en: 'Webhook', zh: 'Webhook' },
  'integration': { en: 'Integration', zh: '集成' },
  'batch-processing': { en: 'Batch Processing', zh: '批量处理' },
  'real-time-processing': { en: 'Real-time Processing', zh: '实时处理' },
  'cloud-storage': { en: 'Cloud Storage', zh: '云存储' },
  'offline-mode': { en: 'Offline Mode', zh: '离线模式' },
  'multi-language': { en: 'Multi-language', zh: '多语言' },
  'custom-branding': { en: 'Custom Branding', zh: '自定义品牌' },
  'white-label': { en: 'White Label', zh: '白标' },

  // ============================================================================
  // General (通用标签)
  // ============================================================================
  'business': { en: 'Business', zh: '商业' },
  'education': { en: 'Education', zh: '教育' },
  'healthcare': { en: 'Healthcare', zh: '医疗健康' },
  'finance': { en: 'Finance', zh: '金融' },
  'e-commerce': { en: 'E-commerce', zh: '电子商务' },
  'real-estate': { en: 'Real Estate', zh: '房地产' },
  'legal': { en: 'Legal', zh: '法律' },
  'entertainment': { en: 'Entertainment', zh: '娱乐' },
  'gaming': { en: 'Gaming', zh: '游戏' },
  'travel': { en: 'Travel', zh: '旅游' },
  'productivity': { en: 'Productivity', zh: '生产力' },
  'creativity': { en: 'Creativity', zh: '创意' },
  'communication': { en: 'Communication', zh: '沟通' },
  'learning': { en: 'Learning', zh: '学习' },
  'research': { en: 'Research', zh: '研究' },
  'sales': { en: 'Sales', zh: '销售' },
  'customer-service': { en: 'Customer Service', zh: '客户服务' },
  'hr': { en: 'HR', zh: '人力资源' },
  'recruiting': { en: 'Recruiting', zh: '招聘' },
  'for-developers': { en: 'For Developers', zh: '面向开发者' },
  'for-designers': { en: 'For Designers', zh: '面向设计师' },
  'for-marketers': { en: 'For Marketers', zh: '面向营销人员' },
  'for-writers': { en: 'For Writers', zh: '面向写作者' },
  'for-students': { en: 'For Students', zh: '面向学生' },
  'for-teams': { en: 'For Teams', zh: '面向团队' },
};

async function resetAndImportTags() {
  console.log('=== 清空标签表并重新导入白名单标签 ===\n');

  try {
    // 步骤 1: 清空翻译表
    console.log('步骤 1: 清空标签翻译表...');
    await db.delete(toolTagTranslations);
    console.log('✓ 标签翻译表已清空\n');

    // 步骤 2: 清空主表
    console.log('步骤 2: 清空标签主表...');
    await db.delete(toolTags);
    console.log('✓ 标签主表已清空\n');

    // 步骤 3: 统计白名单标签
    const allTags = [
      ...TAG_WHITELIST.type.map((slug) => ({ slug, category: 'type' })),
      ...TAG_WHITELIST.pricing.map((slug) => ({ slug, category: 'pricing' })),
      ...TAG_WHITELIST.platform.map((slug) => ({ slug, category: 'platform' })),
      ...TAG_WHITELIST.feature.map((slug) => ({ slug, category: 'feature' })),
      ...TAG_WHITELIST.general.map((slug) => ({ slug, category: 'general' })),
    ];

    console.log(`步骤 3: 准备导入 ${allTags.length} 个标签...\n`);
    console.log('标签分布:');
    console.log(`  - type: ${TAG_WHITELIST.type.length}`);
    console.log(`  - pricing: ${TAG_WHITELIST.pricing.length}`);
    console.log(`  - platform: ${TAG_WHITELIST.platform.length}`);
    console.log(`  - feature: ${TAG_WHITELIST.feature.length}`);
    console.log(`  - general: ${TAG_WHITELIST.general.length}`);
    console.log('');

    // 步骤 4: 批量导入标签
    console.log('步骤 4: 开始导入标签...\n');
    let successCount = 0;
    let failedCount = 0;
    const failedTags: string[] = [];

    for (const { slug, category } of allTags) {
      try {
        const names = TAG_NAMES[slug];
        if (!names) {
          console.warn(`⚠️  标签 "${slug}" 没有配置名称，跳过`);
          failedCount++;
          failedTags.push(slug);
          continue;
        }

        // 使用事务插入标签和翻译
        await db.transaction(async (tx) => {
          // 插入主表
          await tx.insert(toolTags).values({
            id: nanoid(),
            slug,
            category,
            status: 'draft', // 初始状态为 draft
            sortOrder: 0,
            usageCount: 0,
          });

          // 插入英文翻译
          await tx.insert(toolTagTranslations).values({
            id: nanoid(),
            slug,
            locale: 'en',
            name: names.en,
            description: names.description?.en || null,
          });

          // 插入中文翻译
          await tx.insert(toolTagTranslations).values({
            id: nanoid(),
            slug,
            locale: 'zh',
            name: names.zh,
            description: names.description?.zh || null,
          });
        });

        successCount++;
        if (successCount % 20 === 0) {
          console.log(`  已导入 ${successCount}/${allTags.length} 个标签...`);
        }
      } catch (error) {
        failedCount++;
        failedTags.push(slug);
        console.error(`✗ 导入标签 "${slug}" 失败:`, error);
      }
    }

    console.log('');
    console.log('=== 导入完成 ===\n');
    console.log(`📊 统计信息:`);
    console.log(`  - 总数: ${allTags.length}`);
    console.log(`  - 成功: ${successCount}`);
    console.log(`  - 失败: ${failedCount}`);
    console.log('');

    if (failedTags.length > 0) {
      console.log('❌ 失败的标签:');
      failedTags.forEach((slug) => {
        console.log(`  - ${slug}`);
      });
      console.log('');
    }

    // 步骤 5: 验证导入结果
    console.log('步骤 5: 验证导入结果...');
    const tagCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM tool_tags`);
    const translationCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM tool_tag_translations`);
    const enCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM tool_tag_translations WHERE locale = 'en'`);
    const zhCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM tool_tag_translations WHERE locale = 'zh'`);

    const tagCountValue = tagCountResult.rows?.[0] ? (tagCountResult.rows[0] as any).count : 0;
    const translationCountValue = translationCountResult.rows?.[0] ? (translationCountResult.rows[0] as any).count : 0;
    const enCountValue = enCountResult.rows?.[0] ? (enCountResult.rows[0] as any).count : 0;
    const zhCountValue = zhCountResult.rows?.[0] ? (zhCountResult.rows[0] as any).count : 0;

    console.log('✓ 验证结果:');
    console.log(`  - 标签总数: ${tagCountValue}`);
    console.log(`  - 翻译总数: ${translationCountValue}`);
    console.log(`  - 英文翻译: ${enCountValue}`);
    console.log(`  - 中文翻译: ${zhCountValue}`);
    console.log('');

    console.log('✅ 标签表重置和导入完成！');
    console.log('');
    console.log('📋 下一步操作:');
    console.log('  1. 运行标签状态更新脚本:');
    console.log('     pnpm tsx src/lib/cron/update-tag-status.ts');
    console.log('');
    console.log('  2. 为所有工具重新打标签:');
    console.log('     pnpm tsx src/scripts/retag-all-tools.ts --limit 50');
    console.log('');

    return {
      success: true,
      totalCount: allTags.length,
      successCount,
      failedCount,
      failedTags,
    };
  } catch (error) {
    console.error('❌ 重置和导入失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  console.log('⚠️  警告: 此操作将清空所有标签数据！');
  console.log('');
  console.log('按 Ctrl+C 取消，或等待 5 秒后自动开始...');
  console.log('');

  setTimeout(() => {
    resetAndImportTags()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  }, 5000);
}
