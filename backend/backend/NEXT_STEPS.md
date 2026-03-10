# 标签系统后续步骤指南

## ✅ 已完成的工作

### 1. 标签表清空和重新导入
- ✅ 清空 `tool_tag_translations` 表（翻译表）
- ✅ 清空 `tool_tags` 表（主表）
- ✅ 成功导入 **189 个精选标签**
- ✅ 每个标签都包含英文和中文翻译
- ✅ 所有标签初始状态为 `draft`

### 2. 当前状态
- **标签总数**: 189
- **翻译总数**: 378（189 × 2）
- **英文翻译**: 189
- **中文翻译**: 189
- **翻译完整性**: 100%（所有标签都有英文和中文翻译）
- **标签状态**: 所有标签为 `draft`（等待工具关联后更新）

### 3. 标签分布
- **type**（工具类型）: 44 个
- **pricing**（定价模式）: 12 个
- **platform**（平台类型）: 18 个
- **feature**（功能特性）: 90 个
- **general**（通用标签）: 25 个

---

## 📋 后续步骤（按顺序执行）

### 步骤 1: 更新标签状态 ⏳

**目的**: 更新所有标签的 `usageCount` 和 `status`，基于翻译完整性和工具数量的双重检查。

**命令**:
```bash
pnpm tsx src/lib/cron/update-tag-status.ts
```

**预期结果**:
- 更新所有标签的 `usageCount`（统计使用该标签的已发布工具数）
- 根据规则更新标签状态：
  - 翻译完整（英文+中文）且工具数 >= 5 → `status='published'`
  - 其他情况 → `status='draft'`
- 输出详细的统计信息和需要关注的标签

**注意事项**:
- 由于刚导入标签，所有工具的 `tags` 字段可能还是旧标签
- 预计所有标签仍为 `draft` 状态（因为工具还没有关联新标签）
- 这一步主要是验证脚本是否正常工作

---

### 步骤 2: 为所有工具重新打标签 ⏳

**目的**: 使用 AI 为所有已发布的工具重新打标签，确保标签来自白名单，并按优先级排序。

#### 2.1 试运行（推荐先执行）

**命令**:
```bash
# 试运行前 10 个工具（不实际更新数据库）
pnpm tsx src/scripts/retag-all-tools.ts --limit 10 --dry-run
```

**预期结果**:
- 显示将要处理的工具列表
- 不会实际更新数据库
- 用于验证脚本是否正常工作

#### 2.2 分批处理（推荐）

**命令**:
```bash
# 处理前 50 个工具
pnpm tsx src/scripts/retag-all-tools.ts --limit 50 --delay 2000

# 处理第 50-100 个工具
pnpm tsx src/scripts/retag-all-tools.ts --offset 50 --limit 50 --delay 2000

# 处理第 100-150 个工具
pnpm tsx src/scripts/retag-all-tools.ts --offset 100 --limit 50 --delay 2000
```

**预期结果**:
- AI 为每个工具从白名单中选择 5-10 个标签
- 标签按优先级排序（type > pricing > platform > feature > general）
- 自动同步到 `tool_tags` 表（如果标签不存在）
- 自动创建英文和中文翻译
- 更新工具的 `tags` JSON 字段

**注意事项**:
- 每个工具会产生 1 次 API 调用（成本约 $0.01-0.02/工具）
- 使用 `--delay 2000` 避免 API 限流（每个工具间隔 2 秒）
- 建议分批处理，每批 50 个工具
- 如果失败，可以使用 `--offset` 跳过已处理的工具

#### 2.3 处理所有工具（谨慎使用）

**命令**:
```bash
# 处理所有工具（假设有 500 个工具）
pnpm tsx src/scripts/retag-all-tools.ts --delay 2000
```

**预期成本**:
- 假设 500 个工具 × $0.015/工具 ≈ $7.5
- 预计耗时: 500 × 2 秒 ≈ 17 分钟

---

### 步骤 3: 再次更新标签状态 ⏳

**目的**: 在工具重新打标签后，更新标签的 `usageCount` 和 `status`。

**命令**:
```bash
pnpm tsx src/lib/cron/update-tag-status.ts
```

**预期结果**:
- 更新所有标签的 `usageCount`
- 根据工具数量更新标签状态：
  - 工具数 >= 5 且翻译完整 → `status='published'`
  - 工具数 < 5 或翻译不完整 → `status='draft'`
- 输出统计信息：
  - 已发布标签数量
  - 草稿标签数量
  - 缺少翻译的标签
  - 翻译完整但工具数不足的标签

---

### 步骤 4: 验证结果 ⏳

**目的**: 验证标签系统是否正常工作。

**命令**:
```bash
# 验证标签导入和状态
pnpm tsx src/scripts/verify-tags-simple.ts

# 分析标签数据
pnpm tsx src/scripts/analyze-tags.ts
```

**预期结果**:
- 显示标签总数、翻译数量、状态分布
- 显示按类别统计的标签数量
- 显示使用频率最高的标签
- 检测重复标签和薄内容标签

---

### 步骤 5: 清理旧标签数据（可选）⏳

**目的**: 清理工具中不在白名单中的旧标签。

**创建清理脚本**:
```typescript
// src/scripts/clean-old-tags.ts
import '../lib/env-loader';
import { db } from '../db/index';
import { tools } from '@/db/schema';
import { getAllWhitelistTags } from '@/config/tag-whitelist';
import { sql } from 'drizzle-orm';

async function cleanOldTags() {
  const whitelist = getAllWhitelistTags();

  // 更新所有工具，移除不在白名单中的标签
  const result = await db.execute(sql`
    UPDATE tools
    SET tags = (
      SELECT jsonb_agg(tag)
      FROM jsonb_array_elements_text(tags::jsonb) AS tag
      WHERE tag = ANY(${whitelist})
    ),
    updated_at = NOW()
    WHERE tags IS NOT NULL
  `);

  console.log(`✓ 清理完成，更新了 ${result.rowCount} 个工具`);
}

cleanOldTags();
```

**命令**:
```bash
pnpm tsx src/scripts/clean-old-tags.ts
```

---

### 步骤 6: 配置定时任务 ⏳

**目的**: 自动更新标签状态，保持数据同步。

#### 6.1 使用 GitHub Actions

创建 `.github/workflows/update-tag-status.yml`:

```yaml
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

#### 6.2 使用 Vercel Cron Jobs

在 `vercel.json` 中添加:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-tag-status",
      "schedule": "0 2 * * *"
    }
  ]
}
```

创建 API 路由 `src/app/api/cron/update-tag-status/route.ts`:

```typescript
import { updateTagStatusBasedOnUsage } from '@/lib/cron/update-tag-status';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 验证 cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await updateTagStatusBasedOnUsage();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update tag status' },
      { status: 500 }
    );
  }
}
```

---

## 🎯 执行顺序总结

```bash
# 1. 更新标签状态（验证脚本）
pnpm tsx src/lib/cron/update-tag-status.ts

# 2. 试运行重新打标签
pnpm tsx src/scripts/retag-all-tools.ts --limit 10 --dry-run

# 3. 分批重新打标签（假设有 500 个工具）
pnpm tsx src/scripts/retag-all-tools.ts --limit 50 --delay 2000
pnpm tsx src/scripts/retag-all-tools.ts --offset 50 --limit 50 --delay 2000
pnpm tsx src/scripts/retag-all-tools.ts --offset 100 --limit 50 --delay 2000
# ... 继续直到处理完所有工具

# 4. 再次更新标签状态
pnpm tsx src/lib/cron/update-tag-status.ts

# 5. 验证结果
pnpm tsx src/scripts/verify-tags-simple.ts
pnpm tsx src/scripts/analyze-tags.ts

# 6. 配置定时任务（GitHub Actions 或 Vercel Cron）
```

---

## ⚠️ 注意事项

### API 成本估算
- **每个工具**: 1 次 API 调用（约 $0.01-0.02）
- **500 个工具**: 约 $5-10
- **1000 个工具**: 约 $10-20

### 时间估算
- **每个工具**: 约 2-3 秒（包括 API 调用和延迟）
- **500 个工具**: 约 17-25 分钟
- **1000 个工具**: 约 33-50 分钟

### 错误处理
- 如果脚本失败，可以使用 `--offset` 跳过已处理的工具
- 脚本会输出失败的工具列表，可以手动重试
- 建议分批处理，避免一次性处理太多工具

### 数据备份
- 在执行批量操作前，建议备份数据库
- 可以使用 Neon 的快照功能或 `pg_dump`

---

## 📊 监控指标

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

-- 薄内容标签
SELECT COUNT(*) as thin_content_tags
FROM tool_tags
WHERE usage_count > 0 AND usage_count < 5;

-- 未使用标签
SELECT COUNT(*) as unused_tags
FROM tool_tags
WHERE usage_count = 0;
```

---

## 📚 相关文档

- **TAG_SYSTEM_SUMMARY.md** - 快速开始指南
- **TAG_SYSTEM_OPERATIONS.md** - 完整操作指南和命令参考
- **TAG_SYSTEM_IMPLEMENTATION.md** - 详细技术实施文档

---

## 🆘 故障排查

### 问题 1: API 限流
**症状**: 脚本报错 "Rate limit exceeded"

**解决方案**:
```bash
# 增加延迟时间
pnpm tsx src/scripts/retag-all-tools.ts --delay 5000

# 减少批量大小
pnpm tsx src/scripts/retag-all-tools.ts --limit 10
```

### 问题 2: 数据库连接失败
**症状**: "ECONNREFUSED" 或 "Connection timeout"

**解决方案**:
1. 检查 `.env.local` 文件中的 `DATABASE_URL`
2. 确认数据库服务正常运行
3. 检查网络连接

### 问题 3: 标签状态未更新
**症状**: 所有标签仍为 `draft` 状态

**解决方案**:
1. 确认工具已重新打标签
2. 运行 `update-tag-status.ts` 脚本
3. 检查标签的 `usageCount` 是否正确

### 问题 4: 翻译缺失
**症状**: 部分标签缺少英文或中文翻译

**解决方案**:
```bash
# 运行翻译补全脚本
pnpm tsx src/scripts/complete-all-translations.ts --limit 50
```

---

## ✅ 完成检查清单

- [ ] 步骤 1: 更新标签状态（验证脚本）
- [ ] 步骤 2: 为所有工具重新打标签
  - [ ] 试运行 10 个工具
  - [ ] 分批处理所有工具
- [ ] 步骤 3: 再次更新标签状态
- [ ] 步骤 4: 验证结果
- [ ] 步骤 5: 清理旧标签数据（可选）
- [ ] 步骤 6: 配置定时任务
- [ ] 监控关键指标
- [ ] 更新文档

---

**最后更新**: 2026-03-06
**状态**: 标签表已清空并重新导入 189 个精选标签 ✅
