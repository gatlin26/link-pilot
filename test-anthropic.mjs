#!/usr/bin/env node

/**
 * 使用 Anthropic Claude API 测试 LLM 功能
 */

// 从命令行参数或环境变量获取 API Key
const API_KEY = process.argv[2] || process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('❌ 请提供 Anthropic API Key:');
  console.error('   node test-anthropic.mjs <your-api-key>');
  console.error('   或设置环境变量: export ANTHROPIC_API_KEY=sk-ant-xxx');
  process.exit(1);
}

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-3-5-sonnet-20241022';

async function testAnthropicAPI() {
  console.log('🚀 测试 Anthropic Claude API\n');
  console.log('═'.repeat(60));
  console.log(`端点: ${ENDPOINT}`);
  console.log(`模型: ${MODEL}`);
  console.log(`API Key: ${API_KEY.substring(0, 15)}...`);
  console.log('═'.repeat(60) + '\n');

  const prompt = `请为以下博客文章生成一条真诚、有价值的评论。

## 博客文章信息
- 标题: 如何使用 Chrome Extension 开发高效工具
- 描述: 本文介绍了 Chrome Extension MV3 的核心概念和最佳实践，包括 Service Worker、Content Script、消息传递等关键技术
- URL: https://example.com/blog/chrome-extension-guide

## 我的网站信息
- 网站名称: Link Pilot
- 网站 URL: https://linkpilot.com
- 网站简介: 专业的外链管理和自动化填表工具，帮助 SEO 从业者提高工作效率

## 要求
1. 评论应该真诚、自然，像一个真实读者的反馈
2. 先对文章内容表示认可或提出有价值的观点
3. 可以适当提及我的网站作为补充资源，但不要过度营销
4. 评论长度控制在 80-150 字之间
5. 使用中文撰写
6. 不要使用过于正式或模板化的语言

请直接输出评论内容，不要包含任何前缀或解释。`;

  try {
    console.log('📤 发送请求到 Anthropic API...\n');
    const startTime = Date.now();

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: '你是一个专业的博客评论助手，擅长撰写有价值、自然、友好的评论。评论应该真诚、具体，避免过度营销。',
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API 调用失败:');
      console.error(`   状态码: ${response.status}`);
      console.error(`   错误信息: ${error}`);
      return false;
    }

    const data = await response.json();
    const comment = data.content[0]?.text || '';

    console.log('✅ API 调用成功!');
    console.log(`⏱️  耗时: ${elapsed}ms`);
    console.log(`💰 Token 使用: input=${data.usage?.input_tokens}, output=${data.usage?.output_tokens}\n`);
    console.log('📝 生成的评论:');
    console.log('─'.repeat(60));
    console.log(comment);
    console.log('─'.repeat(60));
    console.log(`\n字数: ${comment.length} 字`);

    // 验证评论质量
    console.log('\n🔍 评论质量检查:');
    const checks = {
      '长度合适 (80-150字)': comment.length >= 80 && comment.length <= 150,
      '包含中文': /[\u4e00-\u9fa5]/.test(comment),
      '提到网站': comment.includes('Link Pilot') || comment.includes('linkpilot'),
      '不过度营销': !comment.includes('强烈推荐') && !comment.includes('必备工具'),
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✅' : '⚠️ '} ${check}`);
    });

    return true;
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    return false;
  }
}

async function testExtensionIntegration() {
  console.log('\n\n🔧 扩展集成配置\n');
  console.log('═'.repeat(60));
  console.log('在 Chrome Extension Options 页面使用以下配置:\n');

  const config = {
    enable_llm_comment: true,
    llm_provider: 'anthropic',
    llm_api_key: API_KEY,
    llm_model: MODEL,
  };

  console.log(JSON.stringify(config, null, 2));
  console.log('\n注意: 请妥善保管 API Key，不要提交到代码仓库');
  console.log('═'.repeat(60));
}

async function main() {
  const success = await testAnthropicAPI();

  if (success) {
    await testExtensionIntegration();
    console.log('\n🎉 测试成功！LLM 功能可以正常使用。\n');
  } else {
    console.log('\n⚠️  测试失败，请检查 API Key 和网络连接。\n');
    process.exit(1);
  }
}

main();
