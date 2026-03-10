# 生成 Intro Sections 图片指南

## 📋 当前状态

代码中已配置了占位图片（使用 Unsplash），但你需要替换为实际的产品图片。

## 🎯 方案 1: 使用你的产品生成效果图（推荐）

### 步骤 1: 准备基础图片
选择一张需要处理的图片作为 "Before" 图片：
- 人物照片（有背景、需要处理）
- 产品图片（需要增强或去背景）
- 普通照片（需要优化）

### 步骤 2: 使用你的 AI 产品处理
1. 上传基础图片到你的产品
2. 使用 AI 功能处理（如：去背景、增强、优化等）
3. 下载处理后的图片作为 "After" 图片

### 步骤 3: 保存图片
将图片保存到：
```
public/images/home/intro/
├── what-is-editor.jpg      # 区块 1: 产品界面截图
├── why-before.jpg          # 区块 2: Before 图片
├── why-after.jpg           # 区块 2: After 图片
└── get-started.jpg         # 区块 3: 使用场景图
```

### 步骤 4: 更新代码
修改 `src/components/landing/intro-sections.tsx` 中的图片路径。

---

## 🎯 方案 2: 使用在线 AI 工具生成

### 工具推荐

#### 1. **使用你的产品本身**
- 上传图片 → 处理 → 下载效果图
- 这是最真实的效果展示

#### 2. **AI 图片增强工具**
- **Remove.bg**: 去背景
- **Upscale.media**: 图片增强
- **Canva AI**: 图片编辑和增强

#### 3. **AI 图片生成工具**
- **Flux AI**: 图像到图像转换
- **Midjourney**: 生成高质量图片
- **DALL-E**: 生成和编辑图片

### 操作步骤

1. **准备基础图片**
   - 下载一张免费图片（Unsplash、Pexels）
   - 或使用你自己的照片

2. **使用 AI 工具处理**
   - 上传基础图片
   - 选择处理效果（增强、去背景、优化等）
   - 下载处理后的图片

3. **确保图片匹配**
   - Before 和 After 图片尺寸要一致
   - 构图要相似（主体位置相同）

---

## 🎯 方案 3: 使用占位图片服务（临时方案）

当前代码已使用 Unsplash 占位图片，你可以：

### 替换为本地占位图片
1. 下载占位图片到 `public/images/home/intro/`
2. 更新代码中的路径

### 使用其他占位服务
- **Placeholder.com**: `https://via.placeholder.com/1200x800`
- **Picsum Photos**: `https://picsum.photos/1200/800`
- **Unsplash Source**: `https://source.unsplash.com/1200x800/?photo-editing`

---

## 📝 快速操作指南

### 1. 创建目录
```bash
mkdir -p public/images/home/intro
```

### 2. 准备图片
- **区块 1**: 产品界面截图（1200×800px）
- **区块 2**: Before/After 对比图（各 1200×800px）
- **区块 3**: 使用场景图（1200×800px）

### 3. 优化图片
使用工具压缩图片：
- **TinyPNG**: https://tinypng.com/
- **Squoosh**: https://squoosh.app/
- **ImageOptim**: Mac 应用

### 4. 更新代码路径
在 `intro-sections.tsx` 中更新：
```typescript
imageSrc: '/images/home/intro/what-is-editor.jpg',
beforeImage: '/images/home/intro/why-before.jpg',
afterImage: '/images/home/intro/why-after.jpg',
```

---

## 💡 推荐的工作流程

1. **立即使用占位图片**（当前已配置）
   - 代码已使用 Unsplash 占位图片
   - 可以立即看到效果

2. **准备实际图片**
   - 使用你的产品处理几张图片
   - 保存 Before/After 对比图

3. **替换占位图片**
   - 将实际图片放到 `public/images/home/intro/`
   - 更新代码中的路径

4. **优化和测试**
   - 压缩图片文件大小
   - 测试在不同设备上的显示效果

---

## 🎨 图片要求总结

### 区块 1: What is Edit Photo AI?
- **类型**: 产品界面截图
- **尺寸**: 1200×800px
- **内容**: 展示上传、输入提示词、处理、结果的界面

### 区块 2: Why Choose Us?
- **类型**: Before/After 对比（滑块）
- **尺寸**: 1200×800px（两张图片尺寸必须一致）
- **内容**: 
  - Before: 需要处理的原始图片
  - After: AI 处理后的完美效果

### 区块 3: Get Started
- **类型**: 使用场景展示
- **尺寸**: 1200×800px
- **内容**: 真实的使用场景（人物照、产品图等）

---

## ✅ 检查清单

- [ ] 图片已准备好并优化
- [ ] 图片已放到正确目录
- [ ] Before/After 图片尺寸一致
- [ ] 代码中的路径已更新
- [ ] 在浏览器中测试显示效果
- [ ] 图片在不同设备上显示正常
