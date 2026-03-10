/**
 * 工具内容格式统一脚本
 *
 * 功能：
 * 1. 检查工具内容格式是否符合规范
 * 2. 统一标题格式（What/Features/How/Price/Tips/FAQ）
 * 3. 优化内容结构
 * 4. 生成格式报告
 *
 * 使用方法：
 * node scripts/format-tool-content.js          # 检查格式
 * node scripts/format-tool-content.js --fix    # 自动修复格式
 * node scripts/format-tool-content.js --dry-run # 预览修复
 *
 * @author yiangto
 * @date 2026-01-25
 */

const fs = require('fs');
const path = require('path');

const TOOLS_DIR = path.join(__dirname, '..', 'content', 'tools');
const DRY_RUN = process.argv.includes('--dry-run');
const FIX = process.argv.includes('--fix');

// 确保输出目录存在
if (!fs.existsSync(TOOLS_DIR)) {
  console.error(`❌ 工具目录不存在: ${TOOLS_DIR}`);
  process.exit(1);
}

// 标准章节标题（英文）
const STANDARD_SECTIONS_EN = {
  what: /^###\s+(What|What is|What's|What are)/i,
  features: /^###\s+(Features?|Feature|Key Features?|Main Features?)/i,
  how: /^###\s+(How|How to|How does|How can|Usage|How to Use)/i,
  price: /^###\s+(Pricing|Price|Cost|Pricing Plans?)/i,
  tips: /^###\s+(Tips?|Helpful Tips?|Tips for|Best Practices?|Recommendations?)/i,
  faq: /^###\s+(FAQ|Frequently Asked Questions?|Questions?|Common Questions?)/i,
};

// 标准章节标题（中文）
const STANDARD_SECTIONS_ZH = {
  what: /^###\s+.*?(什么|是什么|介绍|概述)/,
  features: /^###\s+.*?(功能|特性|特点|主要功能|核心功能)/,
  how: /^###\s+.*?(如何|如何使用|使用|使用指南|使用方法)/,
  price: /^###\s+(价格|定价|费用|价格方案)/,
  tips: /^###\s+(提示|建议|技巧|最佳实践|推荐|有用的提示|实用技巧)/,
  faq: /^###\s+(常见问题|问题|FAQ|常见问题解答)/,
};

/**
 * 检测语言
 */
function detectLanguage(content) {
  const zhPattern = /[\u4e00-\u9fa5]/;
  return zhPattern.test(content) ? 'zh' : 'en';
}

/**
 * 解析 MDX 文件
 */
function parseMDX(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = frontmatterMatch[1];
  const body = content.substring(frontmatterMatch[0].length).trim();

  const frontmatter = {};
  const lines = frontmatterText.split('\n');
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    if (line.startsWith('  - ')) {
      if (currentArray) {
        const value = line
          .substring(4)
          .trim()
          .replace(/^["']|["']$/g, '');
        currentArray.push(value);
      }
    } else {
      if (currentKey && currentArray) {
        frontmatter[currentKey] = currentArray;
        currentArray = null;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        currentKey = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        if (value === '[]') {
          frontmatter[currentKey] = [];
        } else if (value === '') {
          currentArray = [];
        } else {
          frontmatter[currentKey] = parseValue(value);
        }
      }
    }
  }

  if (currentKey && currentArray) {
    frontmatter[currentKey] = currentArray;
  }

  return { frontmatter, body };
}

/**
 * 解析值
 */
function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return Number.parseFloat(value);
  return value.replace(/^["']|["']$/g, '');
}

/**
 * 提取章节
 */
function extractSections(body, language) {
  const sections = {};
  const patterns =
    language === 'zh' ? STANDARD_SECTIONS_ZH : STANDARD_SECTIONS_EN;

  const lines = body.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查是否是章节标题
    let matchedSection = null;
    for (const [sectionName, pattern] of Object.entries(patterns)) {
      if (pattern.test(line)) {
        // 保存上一个章节
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        // 开始新章节
        currentSection = sectionName;
        currentContent = [line];
        matchedSection = sectionName;
        break;
      }
    }

    if (!matchedSection && currentSection) {
      currentContent.push(line);
    }
  }

  // 保存最后一个章节
  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * 检查格式
 */
function checkFormat(filePath) {
  const { frontmatter, body } = parseMDX(filePath);
  const language = detectLanguage(body);
  const sections = extractSections(body, language);

  const issues = [];
  const suggestions = [];

  // 检查必需章节
  const requiredSections = ['what', 'features', 'how'];
  const optionalSections = ['price', 'tips', 'faq'];

  for (const section of requiredSections) {
    if (!sections[section]) {
      issues.push(`缺少必需章节: ${section}`);
    }
  }

  // 检查章节顺序
  const sectionOrder = ['what', 'features', 'how', 'price', 'tips', 'faq'];
  const foundSections = Object.keys(sections);
  let lastIndex = -1;

  for (const section of foundSections) {
    const currentIndex = sectionOrder.indexOf(section);
    if (currentIndex < lastIndex) {
      issues.push(`章节顺序不正确: ${section} 应该在更早的位置`);
    }
    lastIndex = currentIndex;
  }

  // 检查标题格式
  for (const [section, content] of Object.entries(sections)) {
    const lines = content.split('\n');
    const titleLine = lines[0];

    // 检查标题是否使用 H3
    if (!titleLine.startsWith('###')) {
      issues.push(`${section} 章节标题应使用 ### (H3)`);
    }

    // 检查内容是否为空（排除只有标题行和空行的情况）
    const contentLines = content
      .split('\n')
      .filter((line) => line.trim() !== '');
    if (contentLines.length <= 1) {
      issues.push(`${section} 章节内容为空`);
    }
  }

  // 生成建议
  if (issues.length > 0) {
    suggestions.push('建议按照标准格式重新组织内容');
  }

  return {
    filePath,
    language,
    frontmatter,
    sections,
    issues,
    suggestions,
    isValid: issues.length === 0,
  };
}

/**
 * 格式化内容
 */
function formatContent(filePath) {
  const { frontmatter, body } = parseMDX(filePath);
  const language = detectLanguage(body);
  const sections = extractSections(body, language);

  // 标准标题映射
  const titleMap = {
    en: {
      what: `### What is ${frontmatter.name}?`,
      features: `### Features of ${frontmatter.name}`,
      how: `### How to Use ${frontmatter.name}`,
      price: '### Pricing',
      tips: '### Helpful Tips',
      faq: '### Frequently Asked Questions',
    },
    zh: {
      what: `### ${frontmatter.name}是什么？`,
      features: `### ${frontmatter.name}的功能`,
      how: `### 如何使用${frontmatter.name}`,
      price: '### 价格',
      tips: '### 有用的提示',
      faq: '### 常见问题解答',
    },
  };

  const sectionOrder = ['what', 'features', 'how', 'price', 'tips', 'faq'];
  const formattedSections = [];

  for (const section of sectionOrder) {
    if (sections[section]) {
      const content = sections[section];
      const lines = content.split('\n');
      // 替换标题
      lines[0] = titleMap[language][section];
      formattedSections.push(lines.join('\n'));
    }
  }

  const formattedBody = formattedSections.join('\n\n');

  // 重新生成 frontmatter
  const frontmatterLines = Object.entries(frontmatter).map(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${key}: []`;
      }
      return `${key}:\n${value.map((v) => `  - "${v}"`).join('\n')}`;
    } else if (typeof value === 'string') {
      return `${key}: "${value.replace(/"/g, '\\"')}"`;
    } else {
      return `${key}: ${value}`;
    }
  });

  const formattedContent = `---
${frontmatterLines.join('\n')}
---

${formattedBody}
`;

  return formattedContent;
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始检查工具内容格式...\n');

  const files = fs
    .readdirSync(TOOLS_DIR)
    .filter((file) => file.endsWith('.mdx'));
  const results = [];
  let totalIssues = 0;

  for (const file of files) {
    const filePath = path.join(TOOLS_DIR, file);
    const result = checkFormat(filePath);
    results.push(result);
    totalIssues += result.issues.length;

    if (result.issues.length > 0) {
      console.log(`❌ ${file}`);
      result.issues.forEach((issue) => {
        console.log(`   - ${issue}`);
      });
      console.log();
    } else {
      console.log(`✅ ${file} - 格式正确`);
    }
  }

  console.log(`\n📊 统计:`);
  console.log(`   - 总文件数: ${files.length}`);
  console.log(`   - 格式正确: ${results.filter((r) => r.isValid).length}`);
  console.log(`   - 需要修复: ${results.filter((r) => !r.isValid).length}`);
  console.log(`   - 总问题数: ${totalIssues}`);

  if (FIX && !DRY_RUN) {
    console.log('\n🔧 开始修复格式...\n');
    let fixedCount = 0;

    for (const result of results) {
      if (!result.isValid) {
        const formattedContent = formatContent(result.filePath);
        fs.writeFileSync(result.filePath, formattedContent, 'utf-8');
        console.log(`✅ 已修复: ${path.basename(result.filePath)}`);
        fixedCount++;
      }
    }

    console.log(`\n✨ 已修复 ${fixedCount} 个文件`);
  } else if (FIX && DRY_RUN) {
    console.log('\n🔧 预览修复（--dry-run 模式）...\n');
    for (const result of results) {
      if (!result.isValid) {
        console.log(`📝 将修复: ${path.basename(result.filePath)}`);
      }
    }
  }

  if (DRY_RUN && !FIX) {
    console.log('\n💡 提示: 使用 --fix 参数可以自动修复格式问题');
    console.log('💡 提示: 使用 --dry-run 参数可以预览修复内容');
  }
}

main();
