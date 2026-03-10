/**
 * 设置 Intro Sections 图片的辅助脚本
 *
 * 使用方法：
 * 1. 准备基础图片，放到 public/images/home/intro/base/ 目录
 * 2. 运行此脚本生成说明文档
 * 3. 使用你的产品处理图片，保存到对应目录
 */

const fs = require('fs');
const path = require('path');

const introDir = path.join(process.cwd(), 'public/images/home/intro');
const baseDir = path.join(introDir, 'base');

// 创建目录结构
const directories = [introDir, baseDir];

directories.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ 创建目录: ${dir}`);
  }
});

// 创建 README 说明文件
const readmeContent = `# Intro Sections 图片说明

## 📁 目录结构

\`\`\`
public/images/home/intro/
├── base/                    # 基础图片（原始图片）
│   ├── why-before.jpg      # 区块 2 的原始图片
│   └── ...
├── what-is-editor.jpg       # 区块 1: 产品界面截图
├── why-before.jpg           # 区块 2: Before 图片
├── why-after.jpg            # 区块 2: After 图片（AI 处理后）
└── get-started.jpg          # 区块 3: 使用场景图
\`\`\`

## 🎯 操作步骤

### 步骤 1: 准备基础图片
1. 下载或准备一张需要处理的图片
2. 放到 \`base/\` 目录，命名为 \`why-before.jpg\`
3. 建议尺寸：1200×800px

### 步骤 2: 使用你的产品处理图片
1. 打开你的 AI 图片编辑产品
2. 上传 \`base/why-before.jpg\`
3. 使用 AI 功能处理（如：去背景、增强、优化等）
4. 下载处理后的图片，保存为 \`why-after.jpg\`

### 步骤 3: 准备其他图片
- **what-is-editor.jpg**: 产品界面截图（可以截图你的产品界面）
- **get-started.jpg**: 使用场景图（可以从 Unsplash 下载）

### 步骤 4: 更新代码
修改 \`src/components/landing/intro-sections.tsx\`:
\`\`\`typescript
imageSrc: '/images/home/intro/what-is-editor.jpg',
beforeImage: '/images/home/intro/why-before.jpg',
afterImage: '/images/home/intro/why-after.jpg',
\`\`\`

## 💡 快速开始

### 使用占位图片（当前方案）
代码已配置使用 Unsplash 占位图片，可以立即看到效果。

### 替换为实际图片
1. 准备图片文件
2. 放到 \`public/images/home/intro/\` 目录
3. 更新代码中的路径
4. 刷新浏览器查看效果

## 📝 图片要求

- **尺寸**: 1200×800px（推荐）
- **格式**: JPG（文件小）或 PNG（质量高）
- **文件大小**: < 500KB（优化后）
- **Before/After**: 两张图片尺寸必须完全一致
`;

fs.writeFileSync(path.join(introDir, 'README.md'), readmeContent);
console.log('✅ 创建 README.md 说明文件');

console.log('\n📋 下一步操作：');
console.log('1. 准备基础图片，放到 public/images/home/intro/base/ 目录');
console.log('2. 使用你的产品处理图片，生成 After 图片');
console.log('3. 更新 src/components/landing/intro-sections.tsx 中的图片路径');
console.log('\n✨ 完成！');
