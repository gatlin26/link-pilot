/**
 * 将 ai-tools-directory 的 JSON 数据转换为 MDX 文件
 *
 * 使用方法：
 * node scripts/convert-tools-to-mdx.js
 */

const fs = require('fs');
const path = require('path');

// 配置路径
const AI_TOOLS_DIR = 'D:\\code\\other\\ai-tools-directory\\data';
const OUTPUT_DIR = path.join(__dirname, '..', 'content', 'tools');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 转换日期格式
 * @param {string} dateStr - 格式如 "2024-05-20 00:00:00" 或 "2024-07-19"
 * @returns {string} - 格式如 "2024-05-20"
 */
function convertDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  return dateStr.split(' ')[0];
}

/**
 * 清理和格式化 Markdown 内容
 * @param {string} content
 * @returns {string}
 */
function cleanMarkdown(content) {
  if (!content) return '';

  // 移除多余的空行
  return content.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 清理 description 字段，移除换行符
 * @param {string} text
 * @returns {string}
 */
function cleanDescription(text) {
  if (!text) return '';

  // 移除换行符，替换为空格
  return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 将 JSON 转换为 MDX
 * @param {object} data - JSON 数据
 * @param {string} locale - 语言代码 (en/cn)
 * @returns {string} - MDX 内容
 */
function convertToMDX(data, locale) {
  const {
    id,
    name,
    title,
    detail = '',
    content = '',
    url,
    imageUrl = '',
    thumbnailUrl,
    collectionTime,
    collectionDate,
    tagName = [],
    categoryName = [],
    starRating = 5,
  } = data;

  // 处理日期
  const date = convertDate(collectionTime || collectionDate);

  // 生成 frontmatter
  const frontmatter = {
    id,
    name,
    title: title || name,
    description: cleanDescription(content || title || name),
    category: categoryName.length > 0 ? categoryName : [],
    tags: tagName.length > 0 ? tagName : [],
    published: true,
    featured: false,
    href: `/tools/${id}`,
    url,
    image: imageUrl || undefined,
    thumbnailUrl: thumbnailUrl || imageUrl || '/images/placeholder.png',
    collectionTime: date,
    starRating,
  };

  // 移除 undefined 值
  Object.keys(frontmatter).forEach((key) => {
    if (frontmatter[key] === undefined) {
      delete frontmatter[key];
    }
  });

  // 生成 MDX 内容
  const mdxContent = `---
${Object.entries(frontmatter)
  .map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: [${value.map((v) => `"${v}"`).join(', ')}]`;
    } else if (typeof value === 'string') {
      return `${key}: "${value.replace(/"/g, '\\"')}"`;
    } else {
      return `${key}: ${value}`;
    }
  })
  .join('\n')}
---

${cleanMarkdown(detail)}
`;

  return mdxContent;
}

/**
 * 处理单个工具
 * @param {string} jsonPath - JSON 文件路径
 * @param {string} locale - 语言代码
 */
function processTool(jsonPath, locale) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // 跳过没有 detail 的工具
    if (!data.detail || data.detail.trim() === '') {
      console.log(`⏭️  跳过 ${data.id} (${locale}): 没有详细内容`);
      return false;
    }

    const mdxContent = convertToMDX(data, locale);
    const outputFileName =
      locale === 'cn' ? `${data.id}.zh.mdx` : `${data.id}.mdx`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);

    fs.writeFileSync(outputPath, mdxContent, 'utf-8');
    console.log(`✅ 已转换: ${outputFileName}`);
    return true;
  } catch (error) {
    console.error(`❌ 转换失败 ${jsonPath}:`, error.message);
    return false;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始转换工具数据...\n');

  const locales = ['en', 'cn'];
  let totalConverted = 0;
  let totalSkipped = 0;

  locales.forEach((locale) => {
    const toolsDir = path.join(AI_TOOLS_DIR, locale, 'tools');

    if (!fs.existsSync(toolsDir)) {
      console.log(`⚠️  目录不存在: ${toolsDir}`);
      return;
    }

    const files = fs
      .readdirSync(toolsDir)
      .filter((file) => file.endsWith('.json') && file !== 'list.json');

    console.log(
      `\n📁 处理 ${locale.toUpperCase()} 工具 (${files.length} 个文件):\n`
    );

    files.forEach((file) => {
      const jsonPath = path.join(toolsDir, file);
      const success = processTool(jsonPath, locale);
      if (success) {
        totalConverted++;
      } else {
        totalSkipped++;
      }
    });
  });

  console.log(`\n✨ 转换完成！`);
  console.log(`   - 成功转换: ${totalConverted} 个文件`);
  console.log(`   - 跳过: ${totalSkipped} 个文件`);
  console.log(`   - 输出目录: ${OUTPUT_DIR}\n`);
}

// 执行
main();
