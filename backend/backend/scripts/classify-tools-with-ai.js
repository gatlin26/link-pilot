/**
 * AI 工具自动分类脚本
 *
 * 功能：
 * 1. 使用 Claude API 分析每个工具的 name + description
 * 2. 自动生成 category 数组（从预定义分类中选择 1-3 个）
 * 3. 自动生成 tags 数组（3-5 个相关标签）
 * 4. 标记 featured 工具（基于质量、知名度、分类代表性）
 * 5. 调整 starRating（增加多样性，3-5 星范围）
 *
 * @author yiangto
 * @date 2026-01-25
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 预定义分类
const CATEGORIES = [
  'Image Generation', // 图像生成
  'Video Generation', // 视频生成
  'Text & Writing', // 文本写作
  'Audio & Music', // 音频音乐
  'Code & Development', // 代码开发
  'Design & Creative', // 设计创意
  'Productivity', // 生产力
  'Marketing & SEO', // 营销 SEO
  'Data & Analytics', // 数据分析
  'Chat & Assistant', // 聊天助手
];

// 初始化 Claude API
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * 解析 MDX 文件的 frontmatter
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('No frontmatter found');
  }

  const frontmatterText = match[1];
  const frontmatter = {};

  // 解析每一行
  const lines = frontmatterText.split('\n');
  let currentKey = null;
  let currentValue = '';

  for (const line of lines) {
    if (line.startsWith('  ') && currentKey) {
      // 继续上一个值
      currentValue += '\n' + line;
    } else {
      // 保存上一个键值对
      if (currentKey) {
        frontmatter[currentKey] = parseValue(currentValue.trim());
      }

      // 解析新的键值对
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        currentKey = line.substring(0, colonIndex).trim();
        currentValue = line.substring(colonIndex + 1).trim();
      }
    }
  }

  // 保存最后一个键值对
  if (currentKey) {
    frontmatter[currentKey] = parseValue(currentValue.trim());
  }

  return {
    frontmatter,
    content: content.substring(match[0].length).trim(),
  };
}

/**
 * 解析值（处理字符串、数字、布尔值、数组）
 */
function parseValue(value) {
  // 空数组
  if (value === '[]') return [];

  // 布尔值
  if (value === 'true') return true;
  if (value === 'false') return false;

  // 数字
  if (/^\d+(\.\d+)?$/.test(value)) return Number.parseFloat(value);

  // 去除引号
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

/**
 * 使用 Claude API 分析工具并生成分类数据
 */
async function classifyTool(name, description, title) {
  const prompt = `请分析以下 AI 工具，并返回 JSON 格式的分类数据：

工具名称：${name}
工具标题：${title}
工具描述：${description}

请从以下预定义分类中选择 1-3 个最合适的分类：
${CATEGORIES.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

要求：
1. categories: 选择 1-3 个最相关的分类（必须从上述列表中选择）
2. tags: 生成 3-5 个相关的英文标签（小写，用连字符分隔，如 "ai-art", "image-editing"）
3. featured: 判断是否应该作为精选工具（基于知名度、质量、功能完整性）
4. starRating: 给出合理的评分（3.5-5.0 之间，保留一位小数）
5. reasoning: 简短说明分类理由（中文，1-2 句话）

请严格按照以下 JSON 格式返回，不要包含任何其他文字：
{
  "categories": ["Category1", "Category2"],
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "featured": true,
  "starRating": 4.5,
  "reasoning": "这是一个知名的图像生成工具，功能强大，用户评价好"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].text.trim();

    // 尝试提取 JSON（可能包含在代码块中）
    let jsonText = responseText;
    const jsonMatch =
      responseText.match(/```json\n([\s\S]*?)\n```/) ||
      responseText.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const result = JSON.parse(jsonText);

    // 验证分类是否有效
    const validCategories = result.categories.filter((cat) =>
      CATEGORIES.includes(cat)
    );
    if (validCategories.length === 0) {
      console.warn(`⚠️  ${name}: 没有有效的分类，使用默认分类`);
      result.categories = ['Productivity'];
    } else {
      result.categories = validCategories;
    }

    // 验证标签
    if (!Array.isArray(result.tags) || result.tags.length < 3) {
      console.warn(`⚠️  ${name}: 标签数量不足，使用默认标签`);
      result.tags = ['ai-tool', 'productivity', 'automation'];
    }

    // 验证评分
    if (result.starRating < 3.5 || result.starRating > 5.0) {
      result.starRating = 4.5;
    }

    return result;
  } catch (error) {
    console.error(`❌ 分析工具 ${name} 时出错:`, error.message);

    // 返回默认值
    return {
      categories: ['Productivity'],
      tags: ['ai-tool', 'productivity', 'automation'],
      featured: false,
      starRating: 4.0,
      reasoning: '自动分类失败，使用默认值',
    };
  }
}

/**
 * 更新 MDX 文件的 frontmatter
 */
function updateMdxFile(filePath, updates) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, content: bodyContent } = parseFrontmatter(content);

  // 更新 frontmatter
  const updatedFrontmatter = {
    ...frontmatter,
    ...updates,
  };

  // 重新生成 frontmatter 文本
  const frontmatterLines = [];
  for (const [key, value] of Object.entries(updatedFrontmatter)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        frontmatterLines.push(`${key}: []`);
      } else {
        frontmatterLines.push(`${key}:`);
        value.forEach((item) => {
          frontmatterLines.push(`  - "${item}"`);
        });
      }
    } else if (typeof value === 'string') {
      frontmatterLines.push(`${key}: "${value}"`);
    } else {
      frontmatterLines.push(`${key}: ${value}`);
    }
  }

  const newContent = `---\n${frontmatterLines.join('\n')}\n---\n\n${bodyContent}`;
  fs.writeFileSync(filePath, newContent, 'utf-8');
}

/**
 * 处理所有工具文件
 */
async function processAllTools() {
  const toolsDir = path.join(__dirname, '../content/tools');
  const files = fs.readdirSync(toolsDir);

  // 只处理英文版本的 MDX 文件（不包含 .zh.mdx）
  const englishFiles = files.filter(
    (file) => file.endsWith('.mdx') && !file.endsWith('.zh.mdx')
  );

  console.log(`📊 找到 ${englishFiles.length} 个工具文件\n`);

  const results = [];
  let featuredCount = 0;
  const categoryDistribution = {};

  for (let i = 0; i < englishFiles.length; i++) {
    const file = englishFiles[i];
    const filePath = path.join(toolsDir, file);

    try {
      // 读取文件
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);

      console.log(
        `[${i + 1}/${englishFiles.length}] 处理: ${frontmatter.name}`
      );

      // 使用 AI 分析
      const classification = await classifyTool(
        frontmatter.name,
        frontmatter.description,
        frontmatter.title
      );

      console.log(`  ✓ 分类: ${classification.categories.join(', ')}`);
      console.log(`  ✓ 标签: ${classification.tags.join(', ')}`);
      console.log(`  ✓ 精选: ${classification.featured ? '是' : '否'}`);
      console.log(`  ✓ 评分: ${classification.starRating}`);
      console.log(`  ✓ 理由: ${classification.reasoning}\n`);

      // 更新英文版本
      updateMdxFile(filePath, {
        category: classification.categories,
        tags: classification.tags,
        featured: classification.featured,
        starRating: classification.starRating,
      });

      // 更新中文版本（保持相同的分类数据）
      const zhFile = file.replace('.mdx', '.zh.mdx');
      const zhFilePath = path.join(toolsDir, zhFile);
      if (fs.existsSync(zhFilePath)) {
        updateMdxFile(zhFilePath, {
          category: classification.categories,
          tags: classification.tags,
          featured: classification.featured,
          starRating: classification.starRating,
        });
      }

      // 统计
      if (classification.featured) {
        featuredCount++;
      }

      classification.categories.forEach((cat) => {
        categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
      });

      results.push({
        name: frontmatter.name,
        ...classification,
      });

      // 避免 API 限流，每次请求后等待 1 秒
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ 处理文件 ${file} 时出错:`, error.message);
    }
  }

  // 输出统计信息
  console.log('\n' + '='.repeat(60));
  console.log('📊 分类统计\n');
  console.log(`总工具数: ${englishFiles.length}`);
  console.log(`精选工具数: ${featuredCount}`);
  console.log(`\n分类分布:`);
  Object.entries(categoryDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} 个工具`);
    });

  console.log('\n' + '='.repeat(60));
  console.log('✅ 所有工具处理完成！');

  // 保存结果到 JSON 文件
  const resultPath = path.join(__dirname, 'classification-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n📄 分类结果已保存到: ${resultPath}`);
}

// 运行脚本
processAllTools().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
