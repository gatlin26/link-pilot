# 工具内容格式规范

## 概述

本文档定义了工具 MDX 文件的内容格式标准，确保所有工具的内容展示统一、清晰、易读。

## 内容结构

每个工具的内容应包含以下标准章节（按顺序）：

### 1. What / 什么 / 工具介绍

**英文格式：**
```markdown
## What is [Tool Name]?
[工具介绍内容，2-3句话描述工具的核心功能和价值]
```

**中文格式：**
```markdown
## [工具名称]是什么？
[工具介绍内容，2-3句话描述工具的核心功能和价值]
```

### 2. Features / 特性 / 功能特点

**英文格式：**
```markdown
## Features of [Tool Name]
- [功能点 1，使用简洁的描述]
- [功能点 2]
- [功能点 3]
- [功能点 4，建议 3-6 个功能点]
```

**中文格式：**
```markdown
## [工具名称]的功能
- [功能点 1，使用简洁的描述]
- [功能点 2]
- [功能点 3]
- [功能点 4，建议 3-6 个功能点]
```

### 3. How / 如何使用

**英文格式：**
```markdown
## How to Use [Tool Name]
1. [步骤 1，清晰简洁]
2. [步骤 2]
3. [步骤 3]
4. [步骤 4，建议 3-5 个步骤]
```

**中文格式：**
```markdown
## 如何使用[工具名称]
1. [步骤 1，清晰简洁]
2. [步骤 2]
3. [步骤 3]
4. [步骤 4，建议 3-5 个步骤]
```

### 4. Pricing / 价格

**英文格式：**
```markdown
## Pricing
[价格信息，包括免费版本、付费计划等。如果价格信息不明确，可以说明"请访问官网查看最新价格信息"]
```

**中文格式：**
```markdown
## 价格
[价格信息，包括免费版本、付费计划等。如果价格信息不明确，可以说明"请访问官网查看最新价格信息"]
```

### 5. Helpful Tips / 有用的提示

**英文格式：**
```markdown
## Helpful Tips
- [提示 1，帮助用户更好地使用工具]
- [提示 2]
- [提示 3，建议 2-4 个提示]
```

**中文格式：**
```markdown
## 有用的提示
- [提示 1，帮助用户更好地使用工具]
- [提示 2]
- [提示 3，建议 2-4 个提示]
```

### 6. Frequently Asked Questions / 常见问题解答

**英文格式：**
```markdown
## Frequently Asked Questions

### [问题 1]
[答案 1，简洁明了]

#### [问题 2]
[答案 2]

#### [问题 3]
[答案 3，建议 3-5 个常见问题]
```

**中文格式：**
```markdown
## 常见问题解答

### [问题 1]
[答案 1，简洁明了]

#### [问题 2]
[答案 2]

#### [问题 3]
[答案 3，建议 3-5 个常见问题]
```

## 格式要求

### 标题层级

- 使用 `##` (H2) 作为主要章节标题（页面 H1 为工具名，introduction 顶层对应 H2）
- 使用 `###` (H3) 作为子章节（如 FAQ 中的问题标题，原 #### 现为 ###）
- 详见 [tool-content-style.md](./tool-content-style.md)

### 列表格式

- 使用无序列表 (`-`) 表示功能点和提示
- 使用有序列表 (`1.`) 表示使用步骤
- 每个列表项应该简洁明了，避免过长的句子

### 文案要求

1. **简洁明了**：每个句子应该清晰、简洁，避免冗长的描述
2. **用户导向**：从用户角度描述功能和价值
3. **准确性**：确保信息准确，避免夸大宣传
4. **一致性**：中英文版本应该保持内容一致，只是语言不同

## 示例

### 英文示例

```markdown
## What is remove.bg?
remove.bg is a tool that allows users to remove the background from images for free. It uses AI technology to automatically remove backgrounds from images in just 5 seconds with one click.

## Features of remove.bg
- 100% automatic background removal
- High-quality results for people, products, animals, cars, and graphics
- Option to make backgrounds transparent (PNG), add a white background, extract or isolate subjects
- Integration with popular design programs, eCommerce sites, and computer environments

## How to Use remove.bg
1. Upload an image or paste the image URL
2. Click on the "Remove Background" button
3. In just 5 seconds, the background will be removed automatically
4. Download the edited image with the background removed

## Pricing
remove.bg offers a free version for users to remove backgrounds from images. For more advanced features and capabilities, users can explore premium options.

## Helpful Tips
- For best results, use high-resolution images
- Ensure the subject is well-defined and distinct from the background
- Experiment with different editing options to achieve the desired effect

## Frequently Asked Questions

### Is remove.bg free to use?
Yes, remove.bg offers a free version for users to remove backgrounds from images.

### Can remove.bg handle complex backgrounds?
remove.bg's AI technology is capable of handling various backgrounds, including intricate patterns and detailed scenes.

### Are there any limitations to the file size for background removal?
While remove.bg can process images of various sizes, it is recommended to use images of reasonable file sizes for optimal performance.
```

### 中文示例

```markdown
## remove.bg是什么？
remove.bg 是一个免费的工具，允许用户从图像中移除背景。它使用 AI 技术，只需一键即可在 5 秒内自动移除图像背景。

## remove.bg的功能
- 100% 自动背景移除
- 为人物、产品、动物、汽车和图形提供高质量结果
- 可选择使背景透明（PNG）、添加白色背景、提取或隔离主体
- 与流行的设计程序、电商网站和计算机环境集成

## 如何使用remove.bg
1. 上传图像或粘贴图像 URL
2. 点击"移除背景"按钮
3. 仅需 5 秒，背景将自动移除
4. 下载已编辑的图像（背景已移除）

## 价格
remove.bg 为用户提供免费版本以移除图像背景。对于更高级的功能和特性，用户可以探索付费选项。

## 有用的提示
- 为获得最佳效果，请使用高分辨率图像
- 确保主体清晰且与背景区分明显
- 尝试不同的编辑选项以达到所需效果

## 常见问题解答

### remove.bg 是免费使用的吗？
是的，remove.bg 为用户提供免费版本以移除图像背景。

### remove.bg 可以处理复杂的背景吗？
remove.bg 的 AI 技术能够处理各种背景，包括复杂的图案和详细的场景。

### 背景移除对文件大小有什么限制吗？
虽然 remove.bg 可以处理各种尺寸的图像，但建议使用合理文件大小的图像以获得最佳性能。
```

## 内容优化建议

1. **保持更新**：定期检查工具信息，确保价格、功能等信息是最新的
2. **用户反馈**：根据用户反馈调整内容，使其更符合用户需求
3. **SEO 优化**：在描述中包含相关关键词，但保持自然流畅
4. **视觉元素**：如果工具支持，可以添加截图或示例图片（通过 MDX 的图片组件）

## 检查清单

在创建或更新工具内容时，请确保：

- [ ] 所有标准章节都已包含
- [ ] 标题格式统一（使用 H3 和 H4）
- [ ] 列表格式正确（功能用无序列表，步骤用有序列表）
- [ ] 文案简洁明了，用户友好
- [ ] 中英文版本内容一致
- [ ] 价格信息准确或已说明需要查看官网
- [ ] FAQ 回答了用户最关心的问题
- [ ] 没有拼写错误或语法错误
