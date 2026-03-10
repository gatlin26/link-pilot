# 标签系统操作指南

## 快速命令参考

### 1. 分析当前标签数据
```bash
# 分析标签统计、检测重复标签
pnpm tsx src/scripts/analyze-tags.ts
```

### 2. 补全标签翻译

#### 方式 A：通过 Action（推荐）
在管理后台或通过 API 调用：
```typescript
// 补全单个标签
await completeTagTranslationsAction({
  slug: 'ai-image-generator',
  autoGenerate: true
});

// 批量补全前 50 个缺失翻译的标签
await batchCompleteTagTranslationsAction({
  limit: 50
});
```

#### 方式 B：创建脚本
创建 `src/scripts/complete-all-translations.ts`:
```typescript
import { batchCompleteTagTranslationsAction } from '@/actions/tags/complete-tag-translations';

async function main() {
  console.log('开始批量补全标签翻译...\n');

  const result = await batchCompleteTagTranslationsAction({ limit: 100 });

  if (result?.data) {
    console.log('\n完成！');
    console.log(`总数: ${result.data.data?.totalCount}`);
    console.log(`成功: ${result.data.data?.successCount}`);
    console.log(`失败: ${result.data.data?.failedCount}`);
  }
}

main().catch(console.error);
```

运行：
```bash
pnpm tsx src/scripts/complete-all-translations.ts
```

### 3. 更新标签状态
```bash
# 更新所有标签的 usageCount 和 status
# 检查翻译完整性和工具数量
pnpm tsx src/lib/cron/update-tag-status.ts
```

### 4. 批量重新打标签
```bash
# 试运行前 10 个工具（不实际更新数据库）
pnpm tsx src/scripts/retag-all-tools.ts --limit 10 --dry-run

# 处理前 50 个工具
pnpm tsx src/scripts/retag-all-tools.ts --limit 50 --delay 2000

# 处理第 100-150 个工具
pnpm tsx src/scripts/retag-all-tools.ts --offset 100 --limit 50

# 处理所有工具（谨慎使用，会产生大量 API 调用）
pnpm tsx src/scripts/retag-all-tools.ts --delay 2000
```

## 推荐执行顺序

### 阶段 1：数据准备
```bash
# 1. 分析当前标签数据
pnpm tsx src/scripts/analyze-tags.ts

# 2. 查看输出，了解：
#    - 标签总数
#    - 缺少翻译的标签数量
#    - 薄内容标签数量
#    - 重复标签
```

### 阶段 2：补全翻译
```bash
# 3. 批量补全所有缺失的翻译
#    （通过 Action 或脚本）
#    建议分批处理，每批 50 个

# 方式 A：创建并运行补全脚本
pnpm tsx src/scripts/complete-all-translations.ts

# 方式 B：在管理后台手动触发
```

### 阶段 3：更新状态
```bash
# 4. 更新标签状态（检查翻译完整性和工具数量）
pnpm tsx src/lib/cron/update-tag-status.ts

# 5. 再次分析，确认状态更新正确
pnpm tsx src/scripts/analyze-tags.ts
```

### 阶段 4：重新打标签（可选）
```bash
# 6. 如果需要重新为所有工具打标签
#    先试运行 10 个工具
pnpm tsx src/scripts/retag-all-tools.ts --limit 10 --dry-run

# 7. 确认无误后，分批处理
pnpm tsx src/scripts/retag-all-tools.ts --limit 50 --delay 2000

# 8. 处理完成后，再次更新标签状态
pnpm tsx src/lib/cron/update-tag-status.ts
```

## 检查标签翻译完整性

### SQL 查询
```sql
-- 查看所有缺少翻译的标签
WITH tag_translation_status AS (
  SELECT
    tt.slug,
    tt.usage_count,
    tt.category,
    tt.status,
    COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'en') as has_en,
    COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'zh') as has_zh
  FROM tool_tags tt
  LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
  GROUP BY tt.slug, tt.usage_count, tt.category, tt.status
)
SELECT
  slug,
  usage_count,
  category,
  status,
  CASE
    WHEN has_en = 0 AND has_zh = 0 THEN 'missing both'
    WHEN has_en = 0 THEN 'missing en'
    WHEN has_zh = 0 THEN 'missing zh'
    ELSE 'complete'
  END as translation_status
FROM tag_translation_status
ORDER BY usage_count DESC;
```

### 使用辅助函数
```typescript
import {
  getTagsMissingTranslations,
  checkTagTranslationCompleteness
} from '@/lib/cron/update-tag-status';

// 获取所有缺少翻译的标签
const missingTags = await getTagsMissingTranslations();
console.log('缺少翻译的标签:', missingTags);

// 检查单个标签
const tagStatus = await checkTagTranslationCompleteness('ai-image-generator');
console.log('标签状态:', tagStatus);
// 输出：
// {
//   slug: 'ai-image-generator',
//   usageCount: 10,
//   category: 'type',
//   status: 'published',
//   hasEnTranslation: true,
//   hasZhTranslation: true,
//   isComplete: true,
//   canPublish: true
// }
```

## 常见问题

### Q1: 标签已经有工具使用，但状态还是 draft？
**A**: 检查翻译完整性。标签必须同时有英文和中文翻译才能发布。

```bash
# 运行状态更新脚本，查看输出
pnpm tsx src/lib/cron/update-tag-status.ts

# 查看 "缺少翻译的标签" 部分
# 使用 completeTagTranslationsAction 补全翻译
```

### Q2: 如何手动为标签添加翻译？
**A**: 直接插入 `tool_tag_translations` 表：

```sql
-- 添加英文翻译
INSERT INTO tool_tag_translations (id, slug, locale, name, description)
VALUES (
  'unique_id',
  'ai-image-generator',
  'en',
  'AI Image Generator',
  'Generate images using artificial intelligence'
);

-- 添加中文翻译
INSERT INTO tool_tag_translations (id, slug, locale, name, description)
VALUES (
  'unique_id_2',
  'ai-image-generator',
  'zh',
  'AI 图像生成器',
  '使用人工智能生成图像'
);

-- 更新标签状态
-- 运行 update-tag-status.ts 脚本
```

### Q3: AI 打标签时创建的标签没有翻译？
**A**: 检查 `extract-tool-tags.ts` 的逻辑。AI 应该同时返回 `enName` 和 `zhName`。

如果 AI 只返回了一种语言的翻译，使用 `completeTagTranslationsAction` 补全。

### Q4: 如何批量删除不在白名单中的标签？
**A**: 创建清理脚本：

```typescript
import { db } from '@/db';
import { toolTags } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { getAllWhitelistTags } from '@/config/tag-whitelist';

async function cleanupTags() {
  const whitelist = getAllWhitelistTags();

  // 删除不在白名单中的标签
  const result = await db.execute(sql`
    DELETE FROM tool_tags
    WHERE slug NOT IN (${sql.join(whitelist.map(tag => sql`${tag}`), sql`, `)})
    RETURNING slug
  `);

  console.log(`删除了 ${result.rowCount} 个不在白名单中的标签`);
}
```

### Q5: 定时任务如何配置？
**A**: 使用 cron 或 GitHub Actions：

```yaml
# .github/workflows/update-tag-status.yml
name: Update Tag Status
on:
  schedule:
    - cron: '0 2 * * *'  # 每天凌晨 2 点运行
  workflow_dispatch:  # 允许手动触发

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm tsx src/lib/cron/update-tag-status.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## 监控指标

### 关键指标
1. **翻译完整率**: 有完整翻译的标签数 / 总标签数
2. **发布率**: published 状态的标签数 / 总标签数
3. **平均工具数**: 每个标签平均使用的工具数
4. **薄内容标签数**: 工具数 < 5 的标签数
5. **未使用标签数**: 工具数 = 0 的标签数

### 监控查询
```sql
-- 翻译完整率
WITH translation_stats AS (
  SELECT
    COUNT(*) as total_tags,
    COUNT(*) FILTER (
      WHERE (
        SELECT COUNT(DISTINCT locale)
        FROM tool_tag_translations
        WHERE slug = tool_tags.slug AND locale IN ('en', 'zh')
      ) = 2
    ) as complete_tags
  FROM tool_tags
)
SELECT
  total_tags,
  complete_tags,
  ROUND(complete_tags::numeric / total_tags * 100, 2) as completion_rate
FROM translation_stats;

-- 发布率
SELECT
  COUNT(*) as total_tags,
  COUNT(*) FILTER (WHERE status = 'published') as published_tags,
  ROUND(COUNT(*) FILTER (WHERE status = 'published')::numeric / COUNT(*) * 100, 2) as publish_rate
FROM tool_tags;

-- 平均工具数
SELECT
  ROUND(AVG(usage_count), 2) as avg_tools_per_tag,
  MAX(usage_count) as max_tools,
  MIN(usage_count) as min_tools
FROM tool_tags;
```

## 故障排查

### 问题：脚本运行失败
```bash
# 检查数据库连接
echo $DATABASE_URL

# 检查 Node.js 版本
node --version  # 应该 >= 18

# 检查依赖安装
pnpm install

# 查看详细错误
pnpm tsx src/scripts/analyze-tags.ts 2>&1 | tee error.log
```

### 问题：API 限流
```bash
# 增加延迟时间
pnpm tsx src/scripts/retag-all-tools.ts --delay 5000

# 减少批量大小
pnpm tsx src/scripts/retag-all-tools.ts --limit 10
```

### 问题：翻译质量不佳
- 检查 AI prompt 是否清晰
- 手动修正翻译后，更新 `tool_tag_translations` 表
- 考虑使用更强大的模型（如 claude-opus-4）
