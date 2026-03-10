# 标签定义生成方案对比

## 三种生成方案

### 方案 1：直接 AI 生成（已完成）

**脚本**: `generate-tag-definitions.ts`

**特点**：
- ✅ 最简单、最快速
- ✅ 无需外部 API
- ❌ 没有参考依据
- ❌ 准确性依赖 AI 知识

**成本**：
- API 调用：189 个标签 ÷ 10 = 19 批次
- 预计成本：$0.50-1.00

**结果**：
- 已生成 179 个标签定义
- 文件：`src/config/tag-definitions.ts`

---

### 方案 2：维基百科 + AI（推荐）⭐

**脚本**: `generate-tag-definitions-simple.ts`

**特点**：
- ✅ 有参考依据（维基百科）
- ✅ 免费（维基百科 API 免费）
- ✅ 权威、准确
- ⚠️ 部分标签可能没有维基百科条目

**流程**：
```
1. 尝试从维基百科获取参考内容
   ├─ 英文维基百科
   └─ 中文维基百科
   ↓
2. 如果没有，使用 AI 生成参考内容
   ↓
3. 基于参考内容生成定义
```

**成本**：
- 维基百科 API：免费
- AI 调用：189 × 3 = 567 次（获取参考 + 生成定义）
- 预计成本：$5-10

**优势**：
- 有据可依
- 可追溯来源
- 质量更高

---

### 方案 3：Google 搜索 + AI

**脚本**: `generate-tag-definitions-with-references.ts`

**特点**：
- ✅ 最全面的参考内容
- ✅ 多个来源（前 5 个搜索结果）
- ❌ 需要 Google API（付费）
- ❌ 速度较慢

**流程**：
```
1. Google 搜索英文参考（前 5 个结果）
   ↓
2. AI 总结英文参考
   ↓
3. Google 搜索中文参考（前 5 个结果）
   ↓
4. AI 总结中文参考
   ↓
5. 基于参考内容生成定义
```

**成本**：
- Google API：189 × 2 = 378 次查询（约 $1.90）
- AI 调用：189 × 3 = 567 次（约 $5-10）
- 总计：约 $7-12

**配置要求**：
- Google API Key
- Google Search Engine ID
- 参考：`docs/GOOGLE_SEARCH_SETUP.md`

---

## 推荐方案

### 🎯 推荐：方案 2（维基百科 + AI）

**理由**：
1. ✅ 免费（无需 Google API）
2. ✅ 有参考依据（维基百科）
3. ✅ 权威准确
4. ✅ 速度适中（约 30-45 分钟）
5. ✅ 成本合理（$5-10）

### 使用方法

```bash
# 1. 运行生成脚本
pnpm tsx src/scripts/generate-tag-definitions-simple.ts

# 2. 审核生成的定义
code src/config/tag-definitions.ts

# 3. 导入到数据库
pnpm tsx src/scripts/import-tag-definitions.ts

# 4. 验证数据
pnpm tsx src/scripts/analyze-tags.ts
```

---

## 生成的数据结构对比

### 方案 1：直接 AI 生成

```typescript
{
  slug: 'ai-image-generator',
  category: 'type',
  en: {
    name: 'AI Image Generator',
    description: '...'
  },
  zh: {
    name: 'AI 图像生成器',
    description: '...'
  }
}
```

### 方案 2：维基百科 + AI

```typescript
{
  slug: 'ai-image-generator',
  category: 'type',
  references: {
    en: {
      source: 'wikipedia',  // 或 'ai-generated'
      content: '维基百科的完整内容...'
    },
    zh: {
      source: 'wikipedia',
      content: '维基百科的中文内容...'
    }
  },
  en: {
    name: 'AI Image Generator',
    description: '基于维基百科生成的描述...'
  },
  zh: {
    name: 'AI 图像生成器',
    description: '基于维基百科生成的描述...'
  }
}
```

### 方案 3：Google 搜索 + AI

```typescript
{
  slug: 'ai-image-generator',
  category: 'type',
  references: {
    en: {
      sources: [
        { url: '...', title: '...', snippet: '...' },
        // ... 最多 5 个来源
      ],
      summary: 'AI 总结的参考内容...'
    },
    zh: {
      sources: [...],
      summary: '...'
    }
  },
  en: {
    name: 'AI Image Generator',
    description: '基于多个来源生成的描述...'
  },
  zh: {
    name: 'AI 图像生成器',
    description: '...'
  }
}
```

---

## 下一步行动

### 选项 A：使用现有的 179 个定义

```bash
# 直接导入现有定义
pnpm tsx src/scripts/import-tag-definitions.ts
```

**优点**：
- 立即可用
- 无需等待

**缺点**：
- 缺少 10 个标签
- 没有参考依据

---

### 选项 B：重新生成（推荐）

```bash
# 使用维基百科 + AI 重新生成
pnpm tsx src/scripts/generate-tag-definitions-simple.ts
```

**优点**：
- 完整的 189 个标签
- 有参考依据
- 质量更高

**缺点**：
- 需要等待 30-45 分钟
- 成本约 $5-10

---

### 选项 C：混合方案

```bash
# 1. 导入现有的 179 个定义
pnpm tsx src/scripts/import-tag-definitions.ts

# 2. 手动补充失败的 10 个标签
# 编辑 src/config/tag-definitions.ts

# 3. 重新导入
pnpm tsx src/scripts/import-tag-definitions.ts
```

---

## 相关文件

- `src/scripts/generate-tag-definitions.ts` - 方案 1（已完成）
- `src/scripts/generate-tag-definitions-simple.ts` - 方案 2（推荐）
- `src/scripts/generate-tag-definitions-with-references.ts` - 方案 3
- `src/scripts/import-tag-definitions.ts` - 导入脚本
- `docs/GOOGLE_SEARCH_SETUP.md` - Google API 配置指南
- `docs/TAG_REFERENCE_CONTENT.md` - 参考内容设计文档
