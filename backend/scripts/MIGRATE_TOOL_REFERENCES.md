# 工具参考内容迁移指南

## 概述

这个迁移脚本用于将现有工具的 `referenceContent` 字段迁移到独立的 `toolReferences` 表中。

## 为什么需要迁移？

原来的设计中，工具的参考内容（网页抓取的内容）直接存储在 `tools` 表的 `referenceContent` 字段中。新的设计将这些内容移到了专门的 `toolReferences` 表，以便：

1. 更好地管理参考内容的来源和状态
2. 支持多次抓取和版本历史
3. 区分自动抓取和手动输入的内容
4. 记录抓取时间和错误信息

## 使用方法

### 1. 预览模式（推荐先运行）

```bash
pnpm tsx scripts/migrate-tool-references.ts --dry-run
```

这会显示将要迁移的工具，但不会实际修改数据库。

### 2. 执行迁移

确认预览结果无误后，运行：

```bash
pnpm tsx scripts/migrate-tool-references.ts
```

## 迁移逻辑

脚本会：

1. 查询所有工具
2. 对于每个有 `referenceContent` 的工具：
   - 检查是否已存在 `toolReferences` 记录
   - 如果不存在，创建新记录
   - 将 `referenceContent` 复制到 `toolReferences.rawContent`
3. 跳过：
   - 没有 `referenceContent` 的工具
   - 已经有 `toolReferences` 记录的工具

## 迁移后的数据结构

迁移后，每个工具的参考内容会存储在 `toolReferences` 表中：

```typescript
{
  id: string,
  toolId: string,              // 关联到 tools 表
  url: string,                 // 工具的 URL
  source: 'manual',            // 标记为手动迁移
  status: 'success',           // 状态
  rawContent: string,          // 原 referenceContent 的内容
  manualNotes: '从 tools.referenceContent 迁移',
  fetchedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 注意事项

1. **幂等性**：脚本可以安全地多次运行，已迁移的工具会被自动跳过
2. **原数据保留**：迁移不会删除 `tools.referenceContent` 字段，原数据仍然保留
3. **备份建议**：虽然脚本是安全的，但建议在生产环境运行前先备份数据库

## 输出示例

```
🔍 DRY RUN 模式 - 仅预览，不执行数据库操作

📊 正在查询所有工具...

找到 150 个工具

✅ [预览] 将迁移 ChatGPT
✅ [预览] 将迁移 Midjourney
⏭️  跳过 Claude - 没有参考内容
⏭️  跳过 Gemini - 已存在参考记录
...

========================================
📊 迁移统计
========================================
总工具数: 150
已迁移: 120
已跳过: 30
失败: 0
========================================

💡 这是预览模式，没有实际修改数据库
💡 运行 pnpm tsx scripts/migrate-tool-references.ts 执行迁移
```

## 故障排除

### 数据库连接失败

确保 `.env.local` 或 `.env` 文件中配置了正确的 `DATABASE_URL`。

### 迁移失败

检查错误信息，常见问题：
- 数据库权限不足
- `toolReferences` 表不存在（需要先运行 `pnpm db:push` 或 `pnpm db:migrate`）
- 网络连接问题

## 后续步骤

迁移完成后：

1. 验证数据：检查 `toolReferences` 表中的数据是否正确
2. 测试功能：在管理后台测试"一键填充"功能
3. （可选）清理：如果确认迁移成功，可以考虑在未来版本中移除 `tools.referenceContent` 字段
