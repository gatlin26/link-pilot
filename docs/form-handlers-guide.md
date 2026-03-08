# 表单识别和自动填充功能

本模块实现了博客评论表单的自动识别、填充和模板学习功能。

## 功能概述

### 1. 表单检测 (Form Detection)
- 自动检测页面是否为博客评论页面
- 识别表单字段：name、email、website、comment、submit
- 支持模板匹配和启发式识别
- 返回检测结果和置信度

### 2. 自动填充 (Auto Fill)
- 自动填充表单字段
- 支持自定义填充数据
- 验证填充结果
- 可选自动提交

### 3. 模板学习 (Template Learning)
- 从成功提交学习表单模板
- 支持模板版本管理
- 自动保存到本地存储

### 4. 手动标注 (Manual Annotation)
- 提供可视化界面让用户标注字段
- 点击页面元素指定字段类型
- 自动生成稳定的选择器
- 保存为模板供后续使用

## 文件结构

```
pages/content/src/
├── form-handlers/
│   ├── form-detector.ts          # 表单检测服务
│   ├── auto-fill-service.ts      # 自动填充服务
│   ├── blog-comment-handler.ts   # 博客评论处理器
│   └── index.ts                  # 导出文件
├── template/
│   ├── template-learner.ts       # 模板学习服务
│   ├── manual-annotation.ts      # 手动标注功能
│   └── index.ts                  # 导出文件
└── form-example.ts               # 使用示例
```

## 使用方法

### 基础使用

```typescript
import { blogCommentHandler } from './form-handlers';

// 页面加载时自动初始化
// 如果检测到表单且有上下文，会自动填充

// 手动触发填充
const result = await blogCommentHandler.manualFill();
console.log('填充结果:', result);
```

### 使用自定义数据

```typescript
const customData = {
  name: 'Zhang San',
  email: 'zhangsan@example.com',
  website: 'https://zhangsan.com',
  comment: '这是一篇很棒的文章！',
};

const result = await blogCommentHandler.manualFill(customData, false);
```

### 手动标注表单

```typescript
import { manualAnnotation } from './template';

// 开始标注
manualAnnotation.start();

// 标注各个字段
manualAnnotation.annotateField('name');     // 然后点击页面上的姓名输入框
manualAnnotation.annotateField('email');    // 然后点击页面上的邮箱输入框
manualAnnotation.annotateField('website');  // 然后点击页面上的网站输入框
manualAnnotation.annotateField('comment');  // 然后点击页面上的评论文本框
manualAnnotation.annotateField('submit');   // 然后点击页面上的提交按钮

// 保存标注
await manualAnnotation.save();
```

### 学习模板

```typescript
import { templateLearner } from './template';

// 从当前页面学习模板
const detectionResult = blogCommentHandler.getDetectionResult();
if (detectionResult && detectionResult.detected) {
  const result = await templateLearner.learnFromCurrentPage(detectionResult.fields);
  console.log('模板学习成功:', result);
}
```

## 技术实现

### 表单检测优先级

1. **模板匹配**（置信度 1.0）
   - 从 templateStorage 查找匹配的模板
   - 根据 domain + page_type + path_pattern 匹配
   - 使用模板中的选择器定位元素

2. **启发式识别**（置信度 0.5-1.0）
   - 通过 name、id、placeholder 等属性识别
   - 根据元素类型和属性匹配度计算置信度

### 字段识别规则

- **name**: `input[name*="name"]`, `input[id*="name"]`, `input[placeholder*="name"]`
- **email**: `input[type="email"]`, `input[name*="email"]`, `input[id*="email"]`
- **website**: `input[name*="url"]`, `input[name*="website"]`, `input[type="url"]`
- **comment**: `textarea[name*="comment"]`, `textarea[id*="comment"]`
- **submit**: `button[type="submit"]`, `input[type="submit"]`

### 选择器生成优先级

1. **ID 选择器**: `#element-id`
2. **Name 选择器**: `input[name="field-name"]`
3. **CSS 路径**: `div.container > form > input.field`

### 模板版本管理

- 每个模板有版本号
- 当字段映射发生变化时，创建新版本
- 保留历史版本以便回溯

## 数据存储

### templateStorage
- 存储位置: `chrome.storage.local`
- 数据结构: `SiteTemplate[]`
- 包含: domain, page_type, path_pattern, field_mappings, version

### submissionStorage
- 存储位置: `chrome.storage.local`
- 数据结构: `Submission[]`
- 包含: opportunity_id, domain, page_url, result, comment_excerpt

### contextService
- 存储位置: `chrome.storage.session`
- 数据结构: `PageContext`
- 包含: opportunity_id, domain, auto_fill_enabled, auto_submit_enabled

## 注意事项

1. **自动填充安全性**
   - 默认不自动点击提交按钮
   - 需要用户明确启用 auto_submit_enabled

2. **模板匹配**
   - 路径模式支持通配符 `*`
   - 例如: `/post/*/comment` 匹配 `/post/123/comment`

3. **字段验证**
   - 填充后会验证字段值是否正确
   - 如果验证失败，返回错误信息

4. **事件触发**
   - 填充时会触发 input 和 change 事件
   - 兼容 React、Vue 等框架的表单

## 扩展功能

### 支持更多页面类型

可以扩展支持其他类型的表单：
- 论坛回复
- 目录提交
- 资源页面提交

### 智能数据填充

可以根据上下文智能生成评论内容：
- 根据文章主题生成相关评论
- 使用 AI 生成个性化内容

### 提交结果检测

可以检测提交是否成功：
- 监听页面变化
- 检测成功/失败提示
- 自动更新提交记录

## 调试

启用调试日志：

```typescript
// 在浏览器控制台中
localStorage.setItem('debug', 'form-handlers:*');
```

查看检测结果：

```typescript
const result = await blogCommentHandler.getDetectionResult();
console.log(result);
```

查看标注状态：

```typescript
const state = manualAnnotation.getState();
console.log(state);
```
