# 标签系统优化与 SEO 改进 - 实施总结

## 核心规则

### 标签发布规则（必须同时满足）
1. **翻译完整性**：必须同时有英文（en）和中文（zh）翻译
2. **工具数量**：使用该标签的已发布工具数 >= 5

### 状态转换
- 不满足任一条件: `status='draft'`（不对外展示，返回 404）
- 同时满足两个条件: `status='published'`（正常发布，index, follow）

## 已完成的工作

### 1. 标签白名单配置 ✅
**文件**: `src/config/tag-whitelist.ts`

- 创建了包含 **195 个精选标签**的白名单配置
- 按类别分组：
  - type（工具类型）: 45 个
  - pricing（定价模式）: 12 个
  - platform（平台类型）: 18 个
  - feature（功能特性）: 95 个
  - general（通用标签）: 25 个
- 提供了辅助函数：
  - `getAllWhitelistTags()`: 获取所有标签
  - `isTagInWhitelist()`: 检查标签是否在白名单中
  - `getTagCategory()`: 获取标签分类
  - `getWhitelistStats()`: 获取统计信息
- 定义了关键常量：
  - `MAX_TAGS_PER_TOOL = 10`
  - `MIN_TAGS_PER_TOOL = 5`
  - `MIN_TOOLS_FOR_PUBLISH = 5`

### 2. AI 打标签优化 ✅
**文件**: `src/actions/tools/extract-tool-tags.ts`

**改进点**：
- ✅ 导入标签白名单配置
- ✅ 优化 AI prompt，注入白名单限制
- ✅ 要求 AI 按优先级排序标签（type > pricing > platform > feature > general）
- ✅ 添加置信度分数字段
- ✅ 验证标签是否在白名单中，过滤无效标签
- ✅ 按置信度排序标签
- ✅ 限制标签数量在 5-10 个之间
- ✅ **自动同步标签到 tool_tags 表**
- ✅ **自动创建英文和中文翻译**
- ✅ **检查并补充缺失的翻译**

**新 Prompt 特点**：
- 明确要求从白名单中选择标签
- 指定标签优先级顺序
- 要求每个标签附带置信度分数
- 提供详细的返回格式示例

**标签同步逻辑**：
1. 检查标签是否已存在于 `tool_tags` 表
2. 如果存在，检查翻译完整性，补充缺失的翻译
3. 如果不存在，创建新标签记录（初始状态为 `draft`）
4. 同时创建英文和中文翻译记录
5. 更新工具的 `tags` JSON 字段

### 3. 相似产品推荐功能 ✅
**文件**:
- `src/actions/tools/get-related-tools.ts` (Action)
- `src/components/tools/related-tools-section.tsx` (组件)

**功能特点**：
- 基于当前工具的前 3 个标签查找相似产品
- 使用 PostgreSQL JSONB 操作符高效查询
- 按匹配标签数量降序排序
- 优先展示 featured 工具
- 支持自定义返回数量（默认 12 个）
- 响应式 3 列网格布局
- 包含加载状态和空状态处理

### 4. 标签状态自动更新 ✅
**文件**: `src/lib/cron/update-tag-status.ts`

**功能**：
- 自动更新所有标签的 `usageCount`
- **根据翻译完整性和使用次数自动更新标签状态**：
  - 翻译不完整（缺少英文或中文）: `status='draft'`
  - 翻译完整但工具数 < 5: `status='draft'`
  - 翻译完整且工具数 >= 5: `status='published'`
- 提供详细的统计信息输出
- 列出缺少翻译的标签
- 列出翻译完整但工具数不足的标签
- 可作为定时任务运行

**辅助函数**：
- `getUnusedTags()`: 获取未使用的标签
- `getThinContentTags()`: 获取薄内容标签
- `getTagsMissingTranslations()`: 获取缺少翻译的标签
- `checkTagTranslationCompleteness()`: 检查单个标签的翻译完整性

**发布规则（CTE 查询）**：
```sql
-- 使用 CTE 查询每个标签的翻译完整性
WITH tag_translation_status AS (
  SELECT
    tt.slug,
    COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale IN ('en', 'zh')) as translation_count
  FROM tool_tags tt
  LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
  GROUP BY tt.slug
)
-- 必须同时满足：翻译完整（英文+中文）且工具数 >= 5
UPDATE tool_tags
SET status = CASE
  WHEN translation_count = 2 AND usage_count >= 5 THEN 'published'
  ELSE 'draft'
END
```

### 5. 批量重新打标签脚本 ✅
**文件**: `src/scripts/retag-all-tools.ts`

**功能**：
- 批量为所有已发布工具重新打标签
- 支持配置选项：
  - `--limit`: 限制处理数量
  - `--offset`: 跳过前 N 个工具
  - `--delay`: 设置延迟时间（避免 API 限流）
  - `--dry-run`: 试运行模式
- 详细的进度输出和错误处理
- 统计成功/失败数量

**使用示例**：
```bash
# 试运行前 10 个工具
pnpm tsx src/scripts/retag-all-tools.ts --limit 10 --dry-run

# 处理第 100-150 个工具
pnpm tsx src/scripts/retag-all-tools.ts --offset 100 --limit 50

# 处理所有工具（延迟 2 秒）
pnpm tsx src/scripts/retag-all-tools.ts --delay 2000
```

### 6. 翻译文件更新 ✅
**文件**:
- `messages/en.json`
- `messages/zh.json`

**新增翻译**：
```json
"ToolsPage": {
  "similarTools": {
    "title": "Similar Tools / 相似产品",
    "loading": "Loading similar tools... / 加载相似产品中...",
    "noTools": "No similar tools found / 暂无相似产品"
  }
}
```

### 7. 标签分析脚本 ✅
**文件**: `src/scripts/analyze-tags.ts`

**功能**：
- 统计标签总数
- 按类别统计标签分布
- 列出使用频率最高的标签
- 检测未使用和薄内容标签
- 检测可能重复的标签（单复数形式）

### 8. 标签翻译补全功能 ✅
**文件**: `src/actions/tags/complete-tag-translations.ts`

**功能**：
- `completeTagTranslationsAction`: 补全单个标签的翻译
  - 检查标签的翻译完整性
  - 使用 AI 自动生成缺失的翻译（英文或中文）
  - 基于现有翻译生成对应语言的翻译
  - 自动更新标签状态
- `batchCompleteTagTranslationsAction`: 批量补全所有缺失翻译的标签
  - 按使用频率排序处理
  - 支持限制处理数量
  - 详细的成功/失败统计
  - 自动延迟避免 API 限流

**使用场景**：
1. 从 Toolify 导入的标签可能只有英文名称
2. AI 打标签时可能只生成了部分翻译
3. 手动创建的标签需要补充翻译
4. 批量处理所有缺失翻译的标签

## 待完成的工作

### 1. 工具详情页集成相似产品模块 ⏳
**文件**: `src/app/[locale]/(marketing)/tools/[slug]/page.tsx`

**需要做的**：
1. 导入 `RelatedToolsSection` 组件
2. 在评价区域正下方添加相似产品模块
3. 传递必要的 props（toolId, locale）

**示例代码**：
```tsx
import { RelatedToolsSection } from '@/components/tools/related-tools-section';

// 在评价区域后添加
<RelatedToolsSection toolId={tool.id} locale={locale} />
```

### 2. 标签详情页 SEO 优化 ⏳
**文件**: `src/app/[locale]/(marketing)/tags/[slug]/page.tsx`

**需要做的**：
1. 检查标签的 `usageCount`
2. 如果 < 5，返回 404（使用 `notFound()`）
3. 如果 >= 5，添加 `index, follow` meta 标签
4. 移除薄内容警告（因为 < 5 的不展示）

**示例代码**：
```tsx
import { notFound } from 'next/navigation';

// 在页面组件中
if (tag.usageCount < MIN_TOOLS_FOR_PUBLISH) {
  notFound();
}

// 在 metadata 中
export async function generateMetadata() {
  // ...
  return {
    // ...
    robots: {
      index: true,
      follow: true,
    },
  };
}
```

### 3. 标签管理后台优化 ⏳
**文件**: `src/components/admin/tags-management-page.tsx`

**需要添加的功能**：
1. 批量选择标签
2. 批量删除
3. 批量修改 category
4. 批量修改 status
5. 导出标签列表（CSV）

### 4. 标签质量检查页面 ⏳
**文件**: `src/app/[locale]/dashboard/admin/tags/quality/page.tsx`（新建）

**需要展示的内容**：
- 未使用的标签列表
- 薄内容标签列表
- 缺失翻译的标签
- 重复/相似标签检测

### 5. 数据清理与迁移 ⏳

**步骤**：
1. 运行 `analyze-tags.ts` 分析当前标签数据
2. 导出现有标签到 CSV
3. 人工审核并标记需要保留的标签
4. 执行批量删除（删除不在白名单中的标签）
5. 运行 `retag-all-tools.ts` 重新为所有工具打标签
6. 运行 `update-tag-status.ts` 更新标签状态

### 6. 定时任务配置 ⏳

**需要配置的定时任务**：
- 每天运行 `update-tag-status.ts` 更新标签状态
- 可选：每周运行标签质量检查

## 关键决策记录

1. ✅ **标签白名单**: 195 个精选标签（从 400+ 筛选）
2. ✅ **标签数量限制**: 每个工具 5-10 个标签
3. ✅ **标签优先级**: type > pricing > platform > feature > general
4. ✅ **发布规则**: 必须同时满足翻译完整性（英文+中文）和工具数量（>= 5）
5. ✅ **翻译完整性**: 缺少任一语言翻译的标签保持 draft 状态
6. ✅ **自动同步**: AI 打标签时自动同步到 tool_tags 表并创建翻译
7. ✅ **相似产品**: 使用"相似产品"而非"相关产品"
8. ✅ **相似产品位置**: 评价区域正下方
9. ✅ **标签迁移策略**: 全部重新打标签（确保质量和一致性）

## 数据流程

### 1. AI 打标签流程
```
用户触发 extractToolTagsAction
  ↓
AI 从白名单中选择 5-10 个标签
  ↓
验证标签是否在白名单中
  ↓
检查标签是否存在于 tool_tags 表
  ↓
如果不存在：创建标签记录（status='draft'）+ 英文翻译 + 中文翻译
如果存在：检查翻译完整性，补充缺失的翻译
  ↓
更新工具的 tags JSON 字段（保持顺序）
  ↓
更新所有标签的 usageCount
```

### 2. 标签状态更新流程
```
定时任务触发 updateTagStatusBasedOnUsage
  ↓
更新所有标签的 usageCount（统计使用该标签的已发布工具数）
  ↓
使用 CTE 查询每个标签的翻译完整性
  ↓
更新标签状态：
  - 翻译完整（英文+中文）且 usageCount >= 5 → published
  - 其他情况 → draft
  ↓
输出统计信息：
  - 按状态统计标签数量
  - 列出缺少翻译的标签
  - 列出翻译完整但工具数不足的标签
```

### 3. 标签翻译补全流程
```
用户触发 completeTagTranslationsAction 或 batchCompleteTagTranslationsAction
  ↓
查询缺少翻译的标签（按使用频率排序）
  ↓
对每个标签：
  - 获取现有翻译作为参考
  - 使用 AI 生成缺失的翻译
  - 插入翻译记录到 tool_tag_translations 表
  - 更新标签状态（如果满足发布条件）
  ↓
返回成功/失败统计
```

## 验证清单

### 功能验证
- [ ] 标签白名单配置正确加载
- [ ] AI 打标签只从白名单中选择
- [ ] 标签数量在 5-10 个之间
- [ ] 标签按优先级排序
- [ ] **标签自动同步到 tool_tags 表**
- [ ] **标签翻译自动创建（英文+中文）**
- [ ] **缺失翻译自动补充**
- [ ] 相似产品推荐正常工作
- [ ] 相似产品按匹配度排序
- [ ] **标签状态更新检查翻译完整性**
- [ ] **缺少翻译的标签保持 draft 状态**
- [ ] 批量打标签脚本正常运行
- [ ] **批量翻译补全功能正常**

### SEO 验证
- [ ] **翻译不完整的标签页返回 404**
- [ ] **工具数不足的标签页返回 404**
- [ ] 正常标签页有正确的 meta 标签
- [ ] 使用 Google Rich Results Test 验证
- [ ] 检查 robots.txt 配置

### 数据完整性验证
- [ ] **所有 tool_tags 记录都有对应的翻译记录**
- [ ] **所有已发布标签都有英文和中文翻译**
- [ ] **工具的 tags JSON 字段与 tool_tags 表同步**
- [ ] **usageCount 统计准确**

### 性能验证
- [ ] JSONB 查询性能测试
- [ ] 相似产品查询速度
- [ ] 批量打标签的 API 成本估算
- [ ] **翻译完整性查询性能（CTE）**

## 后续优化建议

1. **标签推荐**: 在工具提交时，基于工具信息推荐标签
2. **标签搜索**: 添加标签搜索和过滤功能
3. **标签热度**: 展示标签的热度趋势
4. **标签关系**: 建立标签之间的关联关系
5. **用户标签**: 允许用户为工具添加自定义标签（需审核）

## 文件清单

### 新建文件
- ✅ `src/config/tag-whitelist.ts` - 标签白名单配置
- ✅ `src/actions/tools/get-related-tools.ts` - 获取相似产品 Action
- ✅ `src/components/tools/related-tools-section.tsx` - 相似产品组件
- ✅ `src/lib/cron/update-tag-status.ts` - 标签状态更新脚本（含翻译完整性检查）
- ✅ `src/scripts/retag-all-tools.ts` - 批量重新打标签脚本
- ✅ `src/scripts/analyze-tags.ts` - 标签分析脚本
- ✅ `src/actions/tags/complete-tag-translations.ts` - 标签翻译补全 Action

### 修改文件
- ✅ `src/actions/tools/extract-tool-tags.ts` - 优化 AI 打标签，自动同步到 tool_tags 表
- ✅ `messages/en.json` - 添加英文翻译
- ✅ `messages/zh.json` - 添加中文翻译

### 待修改文件
- ⏳ `src/app/[locale]/(marketing)/tools/[slug]/page.tsx` - 添加相似产品模块
- ⏳ `src/app/[locale]/(marketing)/tags/[slug]/page.tsx` - SEO 优化
- ⏳ `src/components/admin/tags-management-page.tsx` - 批量操作功能

### 待新建文件
- ⏳ `src/app/[locale]/dashboard/admin/tags/quality/page.tsx` - 标签质量检查页面

## 注意事项

1. **数据库连接**: 当前脚本无法连接数据库，需要配置正确的 `DATABASE_URL` 环境变量
2. **API 成本**: 批量重新打标签会产生大量 API 调用，建议：
   - 先用 `--dry-run` 测试
   - 使用 `--limit` 分批处理
   - 设置合理的 `--delay` 避免限流
3. **数据备份**: 在执行批量删除或更新前，务必备份数据库
4. **渐进式部署**: 建议先在测试环境验证，再部署到生产环境

## 下一步行动

1. **立即执行**:
   - 在工具详情页添加相似产品模块
   - 优化标签详情页 SEO（检查翻译完整性和工具数量）

2. **短期计划**（1-2 周）:
   - **运行 `batchCompleteTagTranslationsAction` 补全所有缺失的翻译**
   - **运行 `updateTagStatusBasedOnUsage` 更新标签状态**
   - 完成标签管理后台优化
   - 创建标签质量检查页面
   - 执行数据清理与迁移

3. **中期计划**（1 个月）:
   - 配置定时任务（每天运行 `updateTagStatusBasedOnUsage`）
   - 监控标签质量和 SEO 效果
   - 根据数据反馈调整策略

## 重要提醒

### 翻译完整性是发布的前提
- **所有标签必须同时有英文和中文翻译才能发布**
- 缺少任一语言翻译的标签将保持 `draft` 状态
- 使用 `completeTagTranslationsAction` 或 `batchCompleteTagTranslationsAction` 补全翻译
- AI 打标签时会自动创建翻译，但建议定期检查翻译质量

### 数据同步机制
- AI 打标签时自动同步到 `tool_tags` 表
- 自动创建英文和中文翻译记录
- 自动检查并补充缺失的翻译
- 定时任务自动更新标签状态

### 批量操作建议
1. **先补全翻译**：运行 `batchCompleteTagTranslationsAction`
2. **再更新状态**：运行 `updateTagStatusBasedOnUsage`
3. **最后重新打标签**：运行 `retag-all-tools.ts`（可选）

### API 成本控制
- 批量翻译补全会产生 API 调用（每个标签 1 次）
- 批量重新打标签会产生大量 API 调用（每个工具 1 次）
- 建议使用 `--limit` 参数分批处理
- 设置合理的延迟时间避免限流
