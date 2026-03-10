# 标签系统数据架构重新设计

## 问题分析

### 当前问题
1. ❌ 所有标签只有 `name`，缺少 `description` 和 `content`
2. ❌ 没有标签的"参考定义"数据
3. ❌ AI 打标签时无法生成完整的标签内容
4. ❌ 标签详情页因缺少 description 而返回 404

### 根本原因
- 标签白名单（`tag-whitelist.ts`）只定义了 slug，没有定义标签的含义
- AI 打标签时只能根据 slug 猜测标签的含义
- 缺少标签的"标准定义"作为参考

## 解决方案

### 方案 A：扩展白名单配置（推荐）

在 `tag-whitelist.ts` 中为每个标签添加完整定义：

```typescript
// src/config/tag-whitelist.ts

export interface TagDefinition {
  slug: string;
  category: 'type' | 'pricing' | 'platform' | 'feature' | 'general';

  // 英文定义
  en: {
    name: string;
    description: string;
    content?: string;  // 可选的详细内容
  };

  // 中文定义
  zh: {
    name: string;
    description: string;
    content?: string;
  };

  // 元数据
  iconEmoji?: string;
  sortOrder?: number;
}

// 示例
export const TAG_DEFINITIONS: TagDefinition[] = [
  {
    slug: 'ai-image-generator',
    category: 'type',
    en: {
      name: 'AI Image Generator',
      description: 'Tools that use artificial intelligence to generate images from text prompts or other inputs',
      content: '# AI Image Generator\n\nAI image generators are...'
    },
    zh: {
      name: 'AI 图像生成器',
      description: '使用人工智能从文本提示或其他输入生成图像的工具',
      content: '# AI 图像生成器\n\nAI 图像生成器是...'
    },
    iconEmoji: '🎨',
    sortOrder: 1
  },
  {
    slug: 'freemium',
    category: 'pricing',
    en: {
      name: 'Freemium',
      description: 'Free basic features with paid premium upgrades',
      content: '# Freemium Model\n\nFreemium is a pricing strategy...'
    },
    zh: {
      name: '免费增值',
      description: '基础功能免费，高级功能付费',
      content: '# 免费增值模式\n\n免费增值是一种定价策略...'
    },
    iconEmoji: '💎',
    sortOrder: 2
  },
  // ... 其他 193 个标签
];
```

### 方案 B：创建数据库表存储定义

创建新表 `tool_tag_definitions`：

```sql
CREATE TABLE tool_tag_definitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,

  -- 英文定义
  en_name TEXT NOT NULL,
  en_description TEXT NOT NULL,
  en_content TEXT,

  -- 中文定义
  zh_name TEXT NOT NULL,
  zh_description TEXT NOT NULL,
  zh_content TEXT,

  -- 元数据
  icon_emoji TEXT,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## 推荐方案：方案 A（扩展配置文件）

### 优点
1. ✅ 配置即代码，易于版本控制
2. ✅ 不需要数据库迁移
3. ✅ 可以直接在代码中引用
4. ✅ 便于批量导入到数据库

### 实施步骤

#### 1. 创建标签定义配置

```typescript
// src/config/tag-definitions.ts

export const TAG_DEFINITIONS: TagDefinition[] = [
  // Type 类别 (45 个)
  {
    slug: 'ai-image-generator',
    category: 'type',
    en: {
      name: 'AI Image Generator',
      description: 'Tools that use artificial intelligence to generate images from text prompts, sketches, or other images',
    },
    zh: {
      name: 'AI 图像生成器',
      description: '使用人工智能从文本提示、草图或其他图像生成图像的工具',
    },
  },
  {
    slug: 'ai-video-generator',
    category: 'type',
    en: {
      name: 'AI Video Generator',
      description: 'Tools that create videos using artificial intelligence from text, images, or other inputs',
    },
    zh: {
      name: 'AI 视频生成器',
      description: '使用人工智能从文本、图像或其他输入创建视频的工具',
    },
  },

  // Pricing 类别 (12 个)
  {
    slug: 'free',
    category: 'pricing',
    en: {
      name: 'Free',
      description: 'Completely free to use with no paid features or upgrades',
    },
    zh: {
      name: '免费',
      description: '完全免费使用，没有付费功能或升级',
    },
  },
  {
    slug: 'freemium',
    category: 'pricing',
    en: {
      name: 'Freemium',
      description: 'Free basic features with optional paid premium upgrades',
    },
    zh: {
      name: '免费增值',
      description: '基础功能免费，可选付费高级功能',
    },
  },

  // Platform 类别 (18 个)
  {
    slug: 'web-app',
    category: 'platform',
    en: {
      name: 'Web App',
      description: 'Browser-based application accessible through a web browser',
    },
    zh: {
      name: '网页应用',
      description: '通过网页浏览器访问的基于浏览器的应用程序',
    },
  },

  // Feature 类别 (95 个)
  {
    slug: 'text-to-image',
    category: 'feature',
    en: {
      name: 'Text to Image',
      description: 'Generate images from text descriptions or prompts',
    },
    zh: {
      name: '文本转图像',
      description: '从文本描述或提示生成图像',
    },
  },

  // General 类别 (25 个)
  {
    slug: 'business',
    category: 'general',
    en: {
      name: 'Business',
      description: 'Tools designed for business and enterprise use cases',
    },
    zh: {
      name: '商业',
      description: '为商业和企业用例设计的工具',
    },
  },

  // ... 继续添加所有 195 个标签
];
```

#### 2. 创建导入脚本

```typescript
// src/scripts/import-tag-definitions.ts

import { db } from '../db/index';
import { toolTags, toolTagTranslations } from '@/db/schema';
import { TAG_DEFINITIONS } from '@/config/tag-definitions';
import { nanoid } from 'nanoid';

async function importTagDefinitions() {
  console.log('=== 导入标签定义 ===\n');

  let successCount = 0;
  let updateCount = 0;

  for (const def of TAG_DEFINITIONS) {
    try {
      // 1. 检查标签是否存在
      const existingTag = await db.query.toolTags.findFirst({
        where: eq(toolTags.slug, def.slug),
      });

      if (!existingTag) {
        // 创建新标签
        await db.insert(toolTags).values({
          id: nanoid(),
          slug: def.slug,
          category: def.category,
          status: 'draft',
          usageCount: 0,
        });
        console.log(`✓ 创建标签: ${def.slug}`);
        successCount++;
      } else {
        updateCount++;
      }

      // 2. 更新或创建英文翻译
      const existingEn = await db.query.toolTagTranslations.findFirst({
        where: and(
          eq(toolTagTranslations.slug, def.slug),
          eq(toolTagTranslations.locale, 'en')
        ),
      });

      if (existingEn) {
        // 更新现有翻译
        await db.update(toolTagTranslations)
          .set({
            name: def.en.name,
            description: def.en.description,
            content: def.en.content || null,
            updatedAt: new Date(),
          })
          .where(eq(toolTagTranslations.id, existingEn.id));
      } else {
        // 创建新翻译
        await db.insert(toolTagTranslations).values({
          id: nanoid(),
          slug: def.slug,
          locale: 'en',
          name: def.en.name,
          description: def.en.description,
          content: def.en.content || null,
        });
      }

      // 3. 更新或创建中文翻译
      const existingZh = await db.query.toolTagTranslations.findFirst({
        where: and(
          eq(toolTagTranslations.slug, def.slug),
          eq(toolTagTranslations.locale, 'zh')
        ),
      });

      if (existingZh) {
        await db.update(toolTagTranslations)
          .set({
            name: def.zh.name,
            description: def.zh.description,
            content: def.zh.content || null,
            updatedAt: new Date(),
          })
          .where(eq(toolTagTranslations.id, existingZh.id));
      } else {
        await db.insert(toolTagTranslations).values({
          id: nanoid(),
          slug: def.slug,
          locale: 'zh',
          name: def.zh.name,
          description: def.zh.description,
          content: def.zh.content || null,
        });
      }

      console.log(`  ✓ 更新翻译: ${def.en.name} / ${def.zh.name}`);

    } catch (error) {
      console.error(`  ✗ 失败: ${def.slug}`, error);
    }
  }

  console.log('\n=== 导入完成 ===');
  console.log(`新建标签: ${successCount}`);
  console.log(`更新标签: ${updateCount}`);
  console.log(`总计: ${TAG_DEFINITIONS.length}`);
}

importTagDefinitions().catch(console.error);
```

#### 3. 修改 AI 打标签逻辑

```typescript
// src/actions/tools/extract-tool-tags.ts

import { TAG_DEFINITIONS } from '@/config/tag-definitions';

// 在 AI prompt 中注入完整的标签定义
const prompt = `你是一个专业的工具分类专家。请根据以下工具信息，从标签库中选择 5-10 个最相关的标签。

工具信息：
- 名称: ${toolInfo.name}
- URL: ${toolInfo.url}
- 描述: ${toolInfo.translations.map((t) => \`\${t.locale}: \${t.description}\`).join('\\n')}

可用标签库（包含完整定义）：
${JSON.stringify(
  TAG_DEFINITIONS.map(def => ({
    slug: def.slug,
    category: def.category,
    en: def.en.name,
    zh: def.zh.name,
    description: def.en.description,
  })),
  null,
  2
)}

要求：
1. 从标签库中选择 5-10 个最相关的标签
2. 按优先级排序：type > pricing > platform > feature > general
3. 只返回标签的 slug，不需要生成翻译（翻译已在标签库中定义）

返回 JSON 格式：
{
  "tags": [
    { "slug": "ai-image-generator", "confidence": 0.95 },
    { "slug": "freemium", "confidence": 0.90 },
    { "slug": "web-app", "confidence": 0.85 }
  ]
}`;

// AI 只返回 slug，不再生成翻译
// 翻译从 TAG_DEFINITIONS 中读取
```

## 实施计划

### 阶段 1：准备标签定义（1-2 天）
1. 创建 `tag-definitions.ts` 文件
2. 使用 AI 批量生成 195 个标签的定义
3. 人工审核和优化定义

### 阶段 2：导入数据（1 小时）
1. 创建导入脚本
2. 运行脚本导入所有标签定义
3. 验证数据完整性

### 阶段 3：修改 AI 打标签（2 小时）
1. 修改 AI prompt，注入标签定义
2. AI 只返回 slug，不生成翻译
3. 测试打标签功能

### 阶段 4：批量处理（根据工具数量）
1. 为所有工具批量打标签
2. 更新标签状态
3. 验证标签详情页

## 优势

1. **数据一致性**：所有标签的翻译都来自统一的定义
2. **易于维护**：修改标签定义只需更新配置文件
3. **AI 效率**：AI 不需要生成翻译，只需选择标签
4. **SEO 友好**：所有标签都有完整的 name 和 description
5. **可扩展**：未来可以添加更多字段（icon, color, etc.）

## 下一步

你想让我：
1. 使用 AI 批量生成 195 个标签的完整定义？
2. 创建导入脚本？
3. 还是先手动创建几个标签定义作为示例？
