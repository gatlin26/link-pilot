#!/usr/bin/env node

/**
 * 使用自定义 Anthropic API 端点测试 LLM 功能
 */

const API_KEY = 'sk-z0ZuQ5gq90GRH9jlwgZzhVRac7TBbDBhO4yCFHgT424zSblD';
const ENDPOINT = 'https://api.yunnet.top/v1/messages';
const MODEL = 'claude-3-5-sonnet-20241022';

async function testCustomAnthropicAPI() {
  console.log('🚀 测试自定义 Anthropic API 端点\n');
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
    console.log('📤 发送请求...\n');
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
    if (data.usage) {
      console.log(`💰 Token 使用: input=${data.usage.input_tokens}, output=${data.usage.output_tokens}`);
    }
    console.log('\n📝 生成的评论:');
    console.log('─'.repeat(60));
    console.log(comment);
    console.log('─'.repeat(60));
    console.log(`\n字数: ${comment.length} 字`);

    // 验证评论质量
    console.log('\n🔍 评论质量检查:');
    const checks = {
      '长度合适 (80-150字)': comment.length >= 80 && comment.length <= 150,
      '包含中文': /[\u4e00-\u9fa5]/.test(comment),
      '提到网站': comment.includes('Link Pilot') || comment.includes('linkpilot') || comment.includes('外链'),
      '自然真诚': !comment.includes('强烈推荐') && !comment.includes('必备工具'),
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✅' : '⚠️ '} ${check}`);
    });

    return true;
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.error('   请检查网络连接和 API 端点是否可访问');
    return false;
  }
}

async function showExtensionConfig() {
  console.log('\n\n🔧 Chrome Extension 配置\n');
  console.log('═'.repeat(60));
  console.log('在扩展的 Options 页面使用以下配置:\n');

  const config = {
    enable_llm_comment: true,
    llm_provider: 'anthropic',
    llm_api_key: API_KEY,
    llm_model: MODEL,
    llm_custom_endpoint: ENDPOINT,
  };

  console.log(JSON.stringify(config, null, 2));
  console.log('\n💡 提示:');
  console.log('  - 由于使用自定义端点，provider 设置为 "anthropic"');
  console.log('  - llm_custom_endpoint 会覆盖默认的 Anthropic API 地址');
  console.log('  - API Key 会安全存储在 chrome.storage.local 中');
  console.log('═'.repeat(60));
}

async function testMultipleScenarios() {
  console.log('\n\n🧪 测试多个场景\n');
  console.log('═'.repeat(60));

  const scenarios = [
    {
      name: '技术博客评论',
      pageTitle: 'React 18 新特性详解',
      pageDescription: '深入解析 React 18 的并发渲染、自动批处理等新特性',
      websiteName: 'DevTools Hub',
      websiteUrl: 'https://devtools.com',
    },
    {
      name: 'SEO 文章评论',
      pageTitle: '2024年最新的外链建设策略',
      pageDescription: '分享高质量外链获取方法和注意事项',
      websiteName: 'Link Pilot',
      websiteUrl: 'https://linkpilot.com',
    },
  ];

  for (const scenario of scenarios) {
    console.log(`\n📋 场景: ${scenario.name}`);
    console.log(`   页面: ${scenario.pageTitle}`);
    console.log(`   网站: ${scenario.websiteName}`);

    const prompt = `请为以下博客文章生成一条真诚、有价值的评论。

## 博客文章信息
- 标题: ${scenario.pageTitle}
- 描述: ${scenario.pageDescription}

## 我的网站信息
- 网站名称: ${scenario.websiteName}
- 网站 URL: ${scenario.websiteUrl}

## 要求
1. 评论应该真诚、自然，像一个真实读者的反馈
2. 先对文章内容表示认可或提出有价值的观点
3. 可以适当提及我的网站作为补充资源，但不要过度营销
4. 评论长度控制在 80-150 字之间
5. 使用中文撰写

请直接输出评论内容，不要包含任何前缀或解释。`;

    try {
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
          messages: [{ role: 'user', content: prompt }],
          system: '你是一个专业的博客评论助手，擅长撰写有价值、自然、友好的评论。',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const comment = data.content[0]?.text || '';
        console.log(`   ✅ 生成成功 (${comment.length}字)`);
        console.log(`   "${comment.substring(0, 50)}..."`);
      } else {
        console.log(`   ❌ 生成失败: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ 请求失败: ${error.message}`);
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n═'.repeat(60));
}

async function main() {
  const success = await testCustomAnthropicAPI();

  if (success) {
    await showExtensionConfig();
    await testMultipleScenarios();
    console.log('\n🎉 所有测试完成！LLM 功能可以正常使用。\n');
  } else {
    console.log('\n⚠️  测试失败，请检查配置和网络连接。\n');
    process.exit(1);
  }
}

main();
