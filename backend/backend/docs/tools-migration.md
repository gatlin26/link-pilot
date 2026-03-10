# 工具数据 MDX 迁移方案

## 概述

将首页 `ToolsShowcaseSection` 中硬编码的工具数据迁移到 MDX 文件系统，实现内容与代码分离。

## 目标

- ✅ 工具数据从硬编码迁移到 MDX 文件
- ✅ 创建独立的工具列表页和详情页
- ✅ 实现工具提交功能
- ✅ 保持现有 UI 设计和动画效果
- ✅ 支持中英文双语

## 一、MDX 数据结构

### 1.1 目录结构

```
content/tools/
├── text-to-image.mdx           # AI 图像生成器（英文）
├── text-to-image.zh.mdx        # AI 图像生成器（中文）
├── background-removal.mdx      # 背景移除
├── background-removal.zh.mdx
├── image-enhance.mdx           # 图像增强
├── image-enhance.zh.mdx
├── image-upscale.mdx           # 图像放大
├── image-upscale.zh.mdx
├── style-transfer.mdx          # 风格转换
├── style-transfer.zh.mdx
├── object-removal.mdx          # 物体移除
├── object-removal.zh.mdx
├── video-to-video.mdx          # 视频转视频
├── video-to-video.zh.mdx
├── ai-animation.mdx            # AI 动画生成
├── ai-animation.zh.mdx
├── ai-shorts.mdx               # AI 短视频生成
├── ai-shorts.zh.mdx
├── ai-avatar.mdx               # AI 头像生成
├── ai-avatar.zh.mdx
├── video-enhance.mdx           # 视频增强
└── video-enhance.zh.mdx
```

### 1.2 Frontmatter Schema

```typescript
{
  // 基础信息
  id: string;                    // 工具唯一标识，如 'text-to-image'
  name: string;                  // 工具名称（直接文本）
  title: string;                 // 工具标题/副标题
  description: string;           // 工具简短描述

  // 分类和状态
  category: 'image' | 'video';   // 工具分类
  tags: string[];                // 标签数组
  badge?: string;                // 徽章文本，如 'Coming Soon'
  published: boolean;            // 是否发布
  featured: boolean;             // 是否在首页展示

  // 链接和资源
  href: string;                  // 工具页面链接
  url?: string;                  // 外部工具链接
  image: string;                 // 工具缩略图路径
  thumbnailUrl?: string;         // 列表页缩略图

  // SEO 和元数据
  collectionTime: string;        // 收录时间 'YYYY-MM-DD'
  starRating?: number;           // 星级评分 1-5

  // 排序
  order?: number;                // 显示顺序
}
```

### 1.3 MDX 文件示例

**content/tools/text-to-image.mdx**：

```mdx
---
id: text-to-image
name: AI Image Generator
title: Generate stunning images from text descriptions
description: Transform your ideas into beautiful images with advanced AI technology
category: image
tags: [generation, creative, text-to-image]
published: true
featured: true
href: /ai/image
image: /images/features/text-to-image.png
collectionTime: 2025-01-25
starRating: 5
order: 1
---

## What is AI Image Generator?

AI Image Generator is a powerful tool that transforms text descriptions into stunning visual content.

### Key Features

- **Fast Generation**: Create images in under 10 seconds
- **High Quality**: Professional-grade output up to 4K resolution
- **Style Variety**: Choose from multiple artistic styles
- **Easy to Use**: Simple text input, no design skills needed

### How to Use

1. Enter your text description
2. Select your preferred style
3. Click generate
4. Download your image

### Use Cases

- Social media content creation
- Marketing materials
- Blog illustrations
- Product mockups
```

## 二、内容集合配置

### 2.1 修改 source.config.ts

**文件**: `source.config.ts`

在文件末尾添加：

```typescript
/**
 * AI Tools Collection
 */
export const tools = defineCollections({
  type: 'doc',
  dir: 'content/tools',
  schema: frontmatterSchema.extend({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.enum(['image', 'video']),
    tags: z.array(z.string()).default([]),
    badge: z.string().optional(),
    published: z.boolean().default(true),
    featured: z.boolean().default(true),
    href: z.string(),
    url: z.string().optional(),
    image: z.string(),
    thumbnailUrl: z.string().optional(),
    collectionTime: z.string().date(),
    starRating: z.number().min(1).max(5).optional(),
    order: z.number().optional(),
  }),
});
```

### 2.2 修改 src/lib/source.ts

**文件**: `src/lib/source.ts`

1. 在 import 中添加 `tools`：
```typescript
import { author, blog, category, changelog, pages, tools } from '../../.source';
```

2. 在文件末尾添加：
```typescript
/**
 * AI Tools source
 */
export const toolsSource = loader({
  baseUrl: '/tools',
  i18n: i18nConfig,
  source: createMDXSource(tools),
});

export type ToolType = InferPageType<typeof toolsSource>;
```

## 三、页面结构

### 3.1 路由设计

```
/tools                          # 工具列表页（第一页）
/tools/page/[page]              # 工具列表页（分页）
/tools/[slug]                   # 工具详情页
/tools/submit                   # 工具提交页
```

### 3.2 工具列表页

**文件**: `src/app/[locale]/(marketing)/tools/page.tsx`

功能：
- 展示所有已发布的工具（每页 20 个）
- 按 order 和 collectionTime 排序
- 分页组件
- 响应式网格布局

### 3.3 工具详情页

**文件**: `src/app/[locale]/(marketing)/tools/[slug]/page.tsx`

功能：
- 面包屑导航
- 工具标题、描述、徽章
- 星级评分显示
- 操作按钮（Try Now、Visit Website）
- MDX 内容渲染
- SEO 元数据

### 3.4 工具提交页

**文件**: `src/app/[locale]/(marketing)/tools/submit/page.tsx`

功能：
- 提交表单（工具名称、URL、分类、描述、邮箱）
- 表单验证（React Hook Form + Zod）
- Server Action 提交
- 成功/错误提示

## 四、组件实现

### 4.1 工具卡片组件

**文件**: `src/components/tools/tool-card.tsx`

特性：
- 4:3 宽高比图片
- 渐变背景叠加层
- 徽章显示
- Hover 动画效果（Framer Motion）
- 深色模式支持

### 4.2 工具网格组件

**文件**: `src/components/tools/tools-grid-with-pagination.tsx`

特性：
- 响应式网格布局（1-4 列）
- 工具卡片渲染
- 分页组件集成

### 4.3 工具提交表单

**文件**: `src/components/tools/tool-submit-form.tsx`

特性：
- React Hook Form + Zod 验证
- Server Action 提交
- 加载状态和错误处理

### 4.4 分页组件

**文件**: `src/components/shared/pagination.tsx`

特性：
- 页码按钮
- 上一页/下一页
- 当前页高亮
- 路由导航

## 五、首页集成

### 5.1 修改 ToolsShowcaseSection

**文件**: `src/components/landing/tools-showcase-section.tsx`

修改策略：
1. 移除硬编码的 TOOLS 数组
2. 改为服务端组件
3. 从 toolsSource 读取数据
4. 过滤 featured=true 的工具
5. 保持现有 UI 设计和动画
6. Tab 切换逻辑移到客户端子组件

实现方案：
- `ToolsShowcaseSectionServer` - 服务端组件
- `ToolsShowcaseClient` - 客户端组件（Tab 切换）

### 5.2 修改翻译文件

**文件**: `messages/en.json` 和 `messages/zh.json`

修改内容：
- 保留 `toolsShowcase` 的通用文本
- 移除 `toolsShowcase.tools` 下的所有工具翻译
- 添加新的翻译键：
  - `ToolsPage.title`
  - `ToolsPage.description`
  - `ToolsPage.breadcrumb`
  - `ToolsPage.tryNow`
  - `ToolsPage.visitWebsite`
  - `ToolsPage.backToTools`
  - `ToolsPage.submit.*`

## 六、数据迁移

### 6.1 工具列表

**图像工具**（6 个）：
1. text-to-image - AI Image Generator
2. background-removal - Background Removal
3. image-enhance - AI Image Enhancer
4. image-upscale - AI Image Upscaler
5. style-transfer - Style Transfer
6. object-removal - Object Removal

**视频工具**（5 个，标记 Coming Soon）：
1. video-to-video - Video to Video AI
2. ai-animation - AI Animation Generator
3. ai-shorts - AI Shorts Generator
4. ai-avatar - AI Avatar Generator
5. video-enhance - AI Video Enhancer

### 6.2 数据映射

| 硬编码字段 | MDX Frontmatter | 说明 |
|-----------|----------------|------|
| id | id | 保持不变 |
| name (翻译键) | name (直接文本) | 从翻译文件获取 |
| description (翻译键) | description (直接文本) | 从翻译文件获取 |
| image | image | 保持不变 |
| href | href | 保持不变 |
| category | category | 保持不变 |
| badge (翻译键) | badge (直接文本) | 转换为实际文本 |

## 七、Server Actions

### 7.1 工具提交 Action

**文件**: `src/actions/tools/submit-tool.ts`

功能：
- next-safe-action
- Zod schema 验证
- 数据库存储
- 邮件通知（可选）

### 7.2 数据库表

**文件**: `src/db/schema.ts`

添加表：
```typescript
export const toolSubmissions = pgTable('tool_submissions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  url: text('url').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  email: text('email').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

运行迁移：
```bash
pnpm db:generate
pnpm db:migrate
```

## 八、实施步骤

### 步骤 1: 配置内容集合（30 分钟）
1. 修改 `source.config.ts` 添加 tools 集合
2. 修改 `src/lib/source.ts` 添加 toolsSource
3. 运行 `pnpm content` 生成类型

### 步骤 2: 创建 MDX 文件（2 小时）
1. 创建 `content/tools/` 目录
2. 为每个工具创建英文和中文 MDX 文件（共 22 个）
3. 从硬编码数据和翻译文件提取内容
4. 编写工具详细介绍

### 步骤 3: 创建组件（3 小时）
1. 创建 `tool-card.tsx` - 工具卡片
2. 创建 `tools-grid-with-pagination.tsx` - 工具网格
3. 创建 `tool-submit-form.tsx` - 提交表单
4. 创建 `pagination.tsx` - 分页组件

### 步骤 4: 创建页面（2 小时）
1. 创建 `/tools/page.tsx` - 列表页
2. 创建 `/tools/page/[page]/page.tsx` - 分页列表
3. 创建 `/tools/[slug]/page.tsx` - 详情页
4. 创建 `/tools/submit/page.tsx` - 提交页

### 步骤 5: 修改首页（1 小时）
1. 修改 `tools-showcase-section.tsx`
2. 拆分为服务端和客户端组件
3. 从 toolsSource 读取数据
4. 保持现有 UI 和动画

### 步骤 6: 更新翻译（30 分钟）
1. 修改 `messages/en.json`
2. 修改 `messages/zh.json`
3. 移除工具翻译，添加页面翻译

### 步骤 7: Server Actions（1 小时）
1. 创建 `submit-tool.ts` action
2. 添加数据库表
3. 运行数据库迁移

### 步骤 8: 测试验证（1 小时）
1. 功能测试
2. UI/UX 测试
3. SEO 测试
4. 性能测试

## 九、验证清单

### 功能验证
- [ ] 工具列表页正常显示
- [ ] 分页功能正常
- [ ] 工具详情页正常显示
- [ ] 工具提交功能正常
- [ ] 首页工具展示正常
- [ ] Tab 切换功能正常

### UI/UX 验证
- [ ] 响应式布局正常
- [ ] 深色模式正常
- [ ] 动画效果正常
- [ ] 图片加载正常
- [ ] 徽章显示正常

### SEO 验证
- [ ] 元数据正确
- [ ] 面包屑导航正确
- [ ] URL 结构合理
- [ ] 图片 alt 属性完整

### 性能验证
- [ ] 页面加载速度
- [ ] 图片优化
- [ ] 代码分割
- [ ] 静态生成

## 十、技术考虑

### 性能优化
- 使用 Next.js Image 组件优化图片
- 静态生成工具列表和详情页
- 实现增量静态再生成（ISR）
- 代码分割和懒加载

### SEO 优化
- 生成完整的元数据
- 实现面包屑导航
- 使用语义化 HTML
- 添加结构化数据（Schema.org）

### 多语言支持
- 每个工具都有英文和中文版本
- 使用 next-intl 处理路由
- 翻译文件保持同步

### 一致性保持
- 遵循现有的代码风格
- 使用项目的 UI 组件库
- 保持与其他页面的设计一致

## 十一、注意事项

1. **保持现有功能**：迁移过程中不影响现有功能
2. **渐进式迁移**：可以先迁移部分工具，逐步完成
3. **备份数据**：迁移前备份硬编码数据
4. **测试充分**：每个步骤完成后进行测试
5. **文档更新**：更新项目文档和 README

## 十二、预期效果

完成后：
- ✅ 工具数据与代码分离，易于维护
- ✅ 支持独立的工具列表和详情页
- ✅ 支持工具提交功能
- ✅ 保持现有 UI 设计和用户体验
- ✅ 支持中英文双语
- ✅ SEO 友好
- ✅ 性能优化
