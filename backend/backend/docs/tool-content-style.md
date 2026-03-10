# 工具 Introduction 内容样式约定

## 页面结构与标题层级

工具详情页 (`/tools/[slug]`) 的 DOM 结构为：

- **H1**：工具名称（页面主标题）
- **introduction 内容**：Markdown 渲染的介绍正文
- **H2**：Reviews 区块标题

因此，introduction 的 Markdown 内容必须遵循以下约定，以保证正确的标题层级和 SEO/可访问性。

## Markdown 标题约定

| Markdown | 渲染为 | 用途 |
|----------|--------|------|
| `#` | H1 | 不在 introduction 中使用（页面已有 H1） |
| `##` | H2 | **顶层章节标题**（What is X?、Key Features、Use Cases、Pricing 等） |
| `###` | H3 | 子章节（如 FAQ 下的问题标题） |
| `####` | H4 | 更深层级 |
| `#####` | H5 | 更深层级 |
| `######` | H6 | 更深层级 |

## 正确示例

```markdown
## What is {Tool Name}?
A compelling introduction paragraph...

## Key Features
- **Feature 1**: Brief description
- **Feature 2**: Brief description

## Use Cases
One paragraph describing who can benefit...

## Pricing
Brief summary...
```

## 错误示例（勿用）

```markdown
### What is {Tool Name}?   <!-- 错误：### 会渲染为 H3，导致 H1 直接跳到 H3 -->
```

## 内容来源需遵守

- **AI 生成 prompts**：`src/prompts/tool-content-*.txt` 已约定使用 `##` 作为顶层标题
- **Admin 表单**：占位符使用 `## What is {Tool Name}?`
- **MDX 迁移**：若从 `content/tools/*.mdx` 迁移，需确保 body 使用 `##` 作为顶层

## 已有数据修复

若数据库中已有使用 `###` 作为顶层的 introduction，可运行：

```bash
pnpm tsx scripts/normalize-introduction-headings.ts --dry-run  # 预览
pnpm tsx scripts/normalize-introduction-headings.ts           # 执行
```

脚本会将 `###`→`##`、`####`→`###` 等整体上移一级。
