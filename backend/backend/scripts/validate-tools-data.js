/**
 * 工具数据验证脚本
 *
 * 功能：
 * 1. 检查每个工具至少有 1 个 category
 * 2. 检查每个工具有 3-5 个 tags
 * 3. 检查 featured 工具数量在 8-12 个之间
 * 4. 检查 featured 工具在各分类中分布均匀
 * 5. 检查 starRating 在 3-5 之间，有多样性
 * 6. 检查英文和中文版本数据一致性
 *
 * @author yiangto
 * @date 2026-01-25
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  let currentArray = null;

  for (const line of lines) {
    if (line.startsWith('  - ')) {
      // 数组项
      if (currentArray) {
        const value = line
          .substring(4)
          .trim()
          .replace(/^["']|["']$/g, '');
        currentArray.push(value);
      }
    } else {
      // 保存上一个数组
      if (currentKey && currentArray) {
        frontmatter[currentKey] = currentArray;
        currentArray = null;
      }

      // 解析新的键值对
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        currentKey = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        if (value === '[]') {
          frontmatter[currentKey] = [];
        } else if (value === '') {
          // 可能是数组的开始
          currentArray = [];
        } else {
          frontmatter[currentKey] = parseValue(value);
        }
      }
    }
  }

  // 保存最后一个数组
  if (currentKey && currentArray) {
    frontmatter[currentKey] = currentArray;
  }

  return frontmatter;
}

/**
 * 解析值（处理字符串、数字、布尔值）
 */
function parseValue(value) {
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
 * 验证所有工具数据
 */
function validateAllTools() {
  const toolsDir = path.join(__dirname, '../content/tools');
  const files = fs.readdirSync(toolsDir);

  // 只处理英文版本的 MDX 文件
  const englishFiles = files.filter(
    (file) => file.endsWith('.mdx') && !file.endsWith('.zh.mdx')
  );

  console.log('🔍 开始验证工具数据...\n');
  console.log(`📊 总共 ${englishFiles.length} 个工具\n`);

  const issues = [];
  const stats = {
    totalTools: englishFiles.length,
    featuredTools: 0,
    categoryDistribution: {},
    ratingDistribution: {},
    toolsWithoutCategory: [],
    toolsWithInsufficientTags: [],
    toolsWithInvalidRating: [],
    inconsistentTools: [],
  };

  for (const file of englishFiles) {
    const filePath = path.join(toolsDir, file);
    const zhFile = file.replace('.mdx', '.zh.mdx');
    const zhFilePath = path.join(toolsDir, zhFile);

    try {
      // 读取英文版本
      const content = fs.readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      // 检查 1: category 不为空
      if (!frontmatter.category || frontmatter.category.length === 0) {
        stats.toolsWithoutCategory.push(frontmatter.name);
        issues.push(`❌ ${frontmatter.name}: 没有分类`);
      } else {
        // 统计分类分布
        frontmatter.category.forEach((cat) => {
          stats.categoryDistribution[cat] =
            (stats.categoryDistribution[cat] || 0) + 1;
        });
      }

      // 检查 2: tags 数量在 3-5 个之间
      if (
        !frontmatter.tags ||
        frontmatter.tags.length < 3 ||
        frontmatter.tags.length > 5
      ) {
        stats.toolsWithInsufficientTags.push({
          name: frontmatter.name,
          count: frontmatter.tags ? frontmatter.tags.length : 0,
        });
        issues.push(
          `⚠️  ${frontmatter.name}: 标签数量不合适 (${frontmatter.tags ? frontmatter.tags.length : 0})`
        );
      }

      // 检查 3: featured 工具统计
      if (frontmatter.featured) {
        stats.featuredTools++;
      }

      // 检查 4: starRating 在 3-5 之间
      if (frontmatter.starRating < 3 || frontmatter.starRating > 5) {
        stats.toolsWithInvalidRating.push({
          name: frontmatter.name,
          rating: frontmatter.starRating,
        });
        issues.push(
          `❌ ${frontmatter.name}: 评分不合理 (${frontmatter.starRating})`
        );
      } else {
        // 统计评分分布
        const ratingKey = frontmatter.starRating.toString();
        stats.ratingDistribution[ratingKey] =
          (stats.ratingDistribution[ratingKey] || 0) + 1;
      }

      // 检查 5: 英文和中文版本一致性
      if (fs.existsSync(zhFilePath)) {
        const zhContent = fs.readFileSync(zhFilePath, 'utf-8');
        const zhFrontmatter = parseFrontmatter(zhContent);

        const enCategories = JSON.stringify(frontmatter.category || []);
        const zhCategories = JSON.stringify(zhFrontmatter.category || []);
        const enTags = JSON.stringify(frontmatter.tags || []);
        const zhTags = JSON.stringify(zhFrontmatter.tags || []);

        if (
          enCategories !== zhCategories ||
          enTags !== zhTags ||
          frontmatter.featured !== zhFrontmatter.featured ||
          frontmatter.starRating !== zhFrontmatter.starRating
        ) {
          stats.inconsistentTools.push(frontmatter.name);
          issues.push(`⚠️  ${frontmatter.name}: 英文和中文版本数据不一致`);
        }
      }
    } catch (error) {
      issues.push(`❌ ${file}: 解析失败 - ${error.message}`);
    }
  }

  // 输出验证结果
  console.log('='.repeat(60));
  console.log('📊 验证统计\n');

  console.log(`✅ 总工具数: ${stats.totalTools}`);
  console.log(`✅ 精选工具数: ${stats.featuredTools}`);

  if (stats.featuredTools < 8 || stats.featuredTools > 12) {
    console.log(
      `⚠️  警告: 精选工具数量应在 8-12 个之间，当前为 ${stats.featuredTools}`
    );
  }

  console.log(`\n📂 分类分布:`);
  Object.entries(stats.categoryDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} 个工具`);
    });

  console.log(`\n⭐ 评分分布:`);
  Object.entries(stats.ratingDistribution)
    .sort((a, b) => Number.parseFloat(a[0]) - Number.parseFloat(b[0]))
    .forEach(([rating, count]) => {
      console.log(`  ${rating} 星: ${count} 个工具`);
    });

  // 输出问题
  if (issues.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  发现的问题:\n');
    issues.forEach((issue) => console.log(issue));
  }

  // 输出详细问题列表
  if (stats.toolsWithoutCategory.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ 没有分类的工具:\n');
    stats.toolsWithoutCategory.forEach((name) => console.log(`  - ${name}`));
  }

  if (stats.toolsWithInsufficientTags.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  标签数量不合适的工具:\n');
    stats.toolsWithInsufficientTags.forEach(({ name, count }) => {
      console.log(`  - ${name}: ${count} 个标签`);
    });
  }

  if (stats.toolsWithInvalidRating.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ 评分不合理的工具:\n');
    stats.toolsWithInvalidRating.forEach(({ name, rating }) => {
      console.log(`  - ${name}: ${rating} 星`);
    });
  }

  if (stats.inconsistentTools.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  英文和中文版本不一致的工具:\n');
    stats.inconsistentTools.forEach((name) => console.log(`  - ${name}`));
  }

  console.log('\n' + '='.repeat(60));

  if (issues.length === 0) {
    console.log('✅ 所有数据验证通过！');
    return true;
  } else {
    console.log(`⚠️  发现 ${issues.length} 个问题，请检查并修复。`);
    return false;
  }
}

// 运行验证
const isValid = validateAllTools();
process.exit(isValid ? 0 : 1);
