# 使用 Google 搜索生成标签定义

## 概述

这个脚本使用 Google Custom Search API 获取参考内容，然后基于这些参考内容生成标签定义。

## 配置 Google Custom Search API

### 1. 获取 Google API Key

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Custom Search API**
4. 创建 API 凭据（API Key）
5. 复制 API Key

### 2. 创建自定义搜索引擎

1. 访问 [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. 点击 "Add" 创建新的搜索引擎
3. 配置：
   - **Sites to search**: 选择 "Search the entire web"
   - **Name**: 任意名称（如 "Tag Reference Search"）
4. 创建后，获取 **Search engine ID** (cx)

### 3. 配置环境变量

在 `.env.local` 文件中添加：

```bash
# Google Custom Search API
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

## 使用方法

### 运行脚本

```bash
pnpm tsx src/scripts/generate-tag-definitions-with-references.ts
```

### 脚本流程

对于每个标签，脚本会：

1. **Google 搜索英文参考**
   - 搜索查询：`{tag-name} definition technology`
   - 获取前 5 个搜索结果
   - 提取：URL、标题、摘要

2. **总结英文参考**
   - 使用 AI 总结搜索结果
   - 生成 200-300 字的参考内容

3. **Google 搜索中文参考**
   - 搜索查询：`{tag-name} 定义 技术`
   - 获取前 5 个搜索结果

4. **总结中文参考**
   - 使用 AI 总结中文搜索结果

5. **生成标签定义**
   - 基于英文和中文参考内容
   - 生成 name 和 description

### 生成的数据结构

```typescript
{
  slug: 'ai-image-generator',
  category: 'type',

  // 参考来源
  references: {
    en: {
      sources: [
        {
          url: 'https://example.com/ai-image-generator',
          title: 'What is an AI Image Generator?',
          snippet: 'An AI image generator is a tool that...'
        },
        // ... 最多 5 个来源
      ],
      summary: 'AI image generators are tools that use artificial intelligence...'
    },
    zh: {
      sources: [
        {
          url: 'https://example.com/ai-image-generator-zh',
          title: '什么是 AI 图像生成器？',
          snippet: 'AI 图像生成器是一种使用人工智能的工具...'
        },
        // ... 最多 5 个来源
      ],
      summary: 'AI 图像生成器是使用人工智能技术...'
    }
  },

  // 基于参考生成的定义
  en: {
    name: 'AI Image Generator',
    description: 'Tools that use artificial intelligence to generate images from text prompts or other inputs'
  },
  zh: {
    name: 'AI 图像生成器',
    description: '使用人工智能从文本提示或其他输入生成图像的工具'
  }
}
```

## 性能和成本

### 处理速度
- 每个标签约需 10-15 秒
- 189 个标签预计需要 30-45 分钟

### API 成本

#### Google Custom Search API
- **免费额度**: 100 次查询/天
- **付费**: $5 / 1000 次查询
- **本脚本**: 189 标签 × 2 语言 = 378 次查询
- **成本**: 约 $1.90（如果超过免费额度）

#### Anthropic API (Claude Opus 4)
- **总结参考**: 189 × 2 = 378 次调用
- **生成定义**: 189 次调用
- **总计**: 约 567 次调用
- **成本**: 约 $5-10（取决于内容长度）

### 优化建议

1. **分批处理**：
   ```bash
   # 只处理前 20 个标签（测试）
   # 修改脚本，添加 limit 参数
   ```

2. **使用免费额度**：
   - 每天处理 50 个标签（100 次查询 ÷ 2 语言）
   - 4 天完成所有标签

3. **缓存搜索结果**：
   - 保存搜索结果到文件
   - 避免重复搜索

## 无 Google API 的替代方案

如果没有 Google API，脚本会：
1. 跳过搜索步骤
2. 直接使用 AI 生成定义（基于标签名称和分类）
3. 不包含 references 字段

## 示例输出

```
=== 批量生成标签定义（基于 Google 搜索参考）===

总标签数: 189

处理批次 1/38
标签: ai-image-generator, ai-video-generator, ai-text-generator, ai-audio-generator, ai-music-generator

  处理: ai-image-generator (type)
    - 搜索英文参考...
      找到 5 个英文来源
    - 总结英文参考...
    - 搜索中文参考...
      找到 5 个中文来源
    - 总结中文参考...
    - 生成标签定义...
    ✓ 成功生成定义

  处理: ai-video-generator (type)
    ...
```

## 故障排查

### 问题：Google API 配额不足

**解决方案**：
1. 等待第二天（免费额度重置）
2. 或升级到付费计划
3. 或使用替代方案（不搜索，直接 AI 生成）

### 问题：搜索结果质量不佳

**解决方案**：
1. 调整搜索查询（修改脚本中的 searchQuery）
2. 增加搜索结果数量（修改 num 参数）
3. 手动审核和编辑生成的定义

### 问题：AI 总结不准确

**解决方案**：
1. 检查搜索结果是否相关
2. 调整 AI prompt
3. 使用更强大的模型（已使用 Opus 4）

## 下一步

生成完成后：

1. **审核定义**：
   ```bash
   code src/config/tag-definitions.ts
   ```

2. **导入数据库**：
   ```bash
   pnpm tsx src/scripts/import-tag-definitions.ts
   ```

3. **验证数据**：
   ```bash
   pnpm tsx src/scripts/analyze-tags.ts
   ```

## 相关文件

- `src/scripts/generate-tag-definitions-with-references.ts` - 生成脚本
- `src/config/tag-definitions.ts` - 生成的定义文件
- `docs/TAG_REFERENCE_CONTENT.md` - 参考内容设计文档
