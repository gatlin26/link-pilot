# 标签定义生成和导入指南

## 概述

本指南说明如何使用 AI 批量生成标签定义，并导入到数据库中。

## 为什么需要标签定义？

### 当前问题
1. ❌ 所有标签只有 `name`，缺少 `description`
2. ❌ 标签详情页因缺少 description 而返回 404
3. ❌ AI 打标签时需要猜测标签含义，不够准确

### 解决方案
创建标签定义配置文件，包含每个标签的：
- 英文名称和描述
- 中文名称和描述
- 分类信息

## 执行步骤

### 步骤 1：生成标签定义

运行脚本使用 AI 批量生成所有标签的定义：

```bash
pnpm tsx src/scripts/generate-tag-definitions.ts
```

**脚本功能**：
- 读取白名单中的 195 个标签
- 使用 Claude Opus 4 批量生成定义
- 每批处理 10 个标签，避免 API 限流
- 生成 `src/config/tag-definitions.ts` 文件

**预计时间**：约 5-10 分钟（195 个标签 ÷ 10 = 20 批次）

**预计成本**：约 $0.50-1.00（使用 Claude Opus 4）

**输出示例**：
```typescript
// src/config/tag-definitions.ts
export const TAG_DEFINITIONS: TagDefinition[] = [
  {
    slug: 'ai-image-generator',
    category: 'type',
    en: {
      name: 'AI Image Generator',
      description: 'Tools that use artificial intelligence to generate images from text prompts or other inputs'
    },
    zh: {
      name: 'AI 图像生成器',
      description: '使用人工智能从文本提示或其他输入生成图像的工具'
    }
  },
  // ... 其他 194 个标签
];
```

### 步骤 2：审核标签定义（可选）

打开生成的文件，检查定义是否准确：

```bash
code src/config/tag-definitions.ts
```

**检查要点**：
- 名称是否准确、专业
- 描述是否清晰、简洁（50-100 字符）
- 中英文翻译是否对应
- 分类是否正确

### 步骤 3：导入到数据库

运行导入脚本：

```bash
pnpm tsx src/scripts/import-tag-definitions.ts
```

**脚本功能**：
- 读取 `tag-definitions.ts` 文件
- 为每个标签创建或更新数据库记录
- 创建或更新英文和中文翻译
- 验证数据完整性

**预计时间**：约 1-2 分钟

**输出示例**：
```
=== 导入标签定义到数据库 ===

总标签数: 195

处理: ai-image-generator (type)
  ✓ 更新标签
  ✓ 更新英文翻译: AI Image Generator
  ✓ 更新中文翻译: AI 图像生成器

...

=== 导入完成 ===
标签:
  - 新建: 0
  - 更新: 195
翻译:
  - 新建: 0
  - 更新: 390
总计: 195 个标签

=== 验证数据完整性 ===

完整标签: 195
不完整标签: 0

✅ 所有标签数据完整！
```

### 步骤 4：验证结果

运行标签分析脚本验证：

```bash
pnpm tsx src/scripts/analyze-tags.ts
```

检查翻译完整性：

```bash
pnpm tsx -e "
import './src/lib/env-loader.js';
import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  const result = await db.execute(sql\`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '') as has_description
    FROM tool_tag_translations
  \`);

  console.log('翻译统计:');
  console.log(\`  总记录: \${result[0].total}\`);
  console.log(\`  有描述: \${result[0].has_description}\`);
  console.log(\`  完整率: \${(result[0].has_description / result[0].total * 100).toFixed(2)}%\`);
}

check().catch(console.error);
"
```

## 数据结构

### 标签定义接口

```typescript
interface TagDefinition {
  slug: string;           // 标签唯一标识
  category: string;       // 分类：type/pricing/platform/feature/general

  en: {
    name: string;         // 英文名称（如 "AI Image Generator"）
    description: string;  // 英文描述（50-100 字符）
  };

  zh: {
    name: string;         // 中文名称（如 "AI 图像生成器"）
    description: string;  // 中文描述（50-100 字符）
  };
}
```

### 数据库表

**tool_tags 表**：
- `slug`: 标签唯一标识
- `category`: 分类
- `status`: 状态（draft/published）
- `usage_count`: 使用次数

**tool_tag_translations 表**：
- `slug`: 关联的标签
- `locale`: 语言（en/zh）
- `name`: 名称 ✅
- `description`: 描述 ✅
- `content`: 详细内容（可选）

## 常见问题

### Q1: 生成的定义不准确怎么办？

**A**: 手动编辑 `src/config/tag-definitions.ts` 文件，然后重新运行导入脚本。

### Q2: 如何添加新标签？

**A**:
1. 在 `tag-whitelist.ts` 中添加新标签的 slug
2. 重新运行 `generate-tag-definitions.ts`
3. 运行 `import-tag-definitions.ts` 导入

### Q3: 如何更新单个标签的定义？

**A**:
1. 编辑 `tag-definitions.ts` 中对应的标签
2. 运行 `import-tag-definitions.ts` 重新导入
3. 脚本会自动更新数据库中的记录

### Q4: 导入后标签详情页还是 404？

**A**: 检查以下条件：
1. 标签是否有完整的英文和中文翻译（包括 description）
2. 标签的 `usage_count` 是否 >= 5
3. 运行 `update-tag-status.ts` 更新标签状态

### Q5: 如何批量更新所有标签？

**A**:
```bash
# 1. 重新生成定义
pnpm tsx src/scripts/generate-tag-definitions.ts

# 2. 导入到数据库
pnpm tsx src/scripts/import-tag-definitions.ts

# 3. 更新标签状态
pnpm tsx src/lib/cron/update-tag-status.ts
```

## 下一步

完成标签定义导入后：

1. **为工具打标签**：
   ```bash
   pnpm tsx src/scripts/retag-all-tools.ts --limit 10 --dry-run
   ```

2. **更新标签状态**：
   ```bash
   pnpm tsx src/lib/cron/update-tag-status.ts
   ```

3. **验证标签详情页**：
   访问 `/tags/[slug]` 确认页面正常显示

## 维护建议

1. **定期审核**：每季度审核标签定义，确保准确性
2. **版本控制**：`tag-definitions.ts` 纳入 Git 版本控制
3. **文档更新**：标签定义变更时更新相关文档
4. **数据备份**：导入前备份数据库

## 相关文件

- `src/config/tag-whitelist.ts` - 标签白名单（195 个 slug）
- `src/config/tag-definitions.ts` - 标签定义（生成的文件）
- `src/scripts/generate-tag-definitions.ts` - 生成脚本
- `src/scripts/import-tag-definitions.ts` - 导入脚本
- `docs/TAG_SYSTEM_REDESIGN.md` - 设计文档
