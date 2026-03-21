#!/usr/bin/env node

/**
 * LLM 功能测试脚本
 * 测试 Ollama 本地 LLM 是否可以正常调用
 */

const OLLAMA_ENDPOINT = 'http://localhost:11434/v1/chat/completions';
const MODEL = 'qwen2.5:7b';

async function testOllamaConnection() {
  console.log('🔍 测试 Ollama 连接...');
  console.log(`端点: ${OLLAMA_ENDPOINT}`);
  console.log(`模型: ${MODEL}\n`);

  const prompt = `请为以下博客文章生成一条真诚、有价值的评论。

## 博客文章信息
- 标题: 如何使用 Chrome Extension 开发高效工具
- 描述: 本文介绍了 Chrome Extension MV3 的核心概念和最佳实践
- URL: https://example.com/blog/chrome-extension-guide

## 我的网站信息
- 网站名称: Link Pilot
- 网站 URL: https://linkpilot.com
- 网站简介: 专业的外链管理和自动化填表工具

## 要求
1. 评论应该真诚、自然，像一个真实读者的反馈
2. 先对文章内容表示认可或提出有价值的观点
3. 可以适当提及我的网站作为补充资源，但不要过度营销
4. 评论长度控制在 80-150 字之间
5. 使用中文撰写
6. 不要使用过于正式或模板化的语言

请直接输出评论内容，不要包含任何前缀或解释。`;

  try {
    console.log('📤 发送请求...');
    const startTime = Date.now();

    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的博客评论助手，擅长撰写有价值、自然、友好的评论。评论应该真诚、具体，避免过度营销。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ 请求失败:', response.status, error);
      return false;
    }

    const data = await response.json();
    const comment = data.choices[0]?.message?.content || '';

    console.log('✅ 请求成功!');
    console.log(`⏱️  耗时: ${elapsed}ms\n`);
    console.log('📝 生成的评论:');
    console.log('─'.repeat(60));
    console.log(comment);
    console.log('─'.repeat(60));
    console.log(`\n字数: ${comment.length} 字`);

    return true;
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.log('\n💡 请确保:');
    console.log('1. Ollama 服务已启动: ollama serve');
    console.log('2. 模型已下载: ollama pull qwen2.5:7b');
    console.log('3. 端点地址正确: http://localhost:11434');
    return false;
  }
}

async function testOpenAIFormat() {
  console.log('\n\n🔍 测试 OpenAI 格式兼容性...\n');

  const testPayload = {
    model: MODEL,
    messages: [
      { role: 'user', content: '你好，请用一句话介绍你自己。' }
    ],
    temperature: 0.7,
    max_tokens: 100,
  };

  try {
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    if (!response.ok) {
      console.error('❌ 格式测试失败:', response.status);
      return false;
    }

    const data = await response.json();
    console.log('✅ OpenAI 格式兼容');
    console.log('📝 响应:', data.choices[0]?.message?.content);
    return true;
  } catch (error) {
    console.error('❌ 格式测试失败:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Link Pilot LLM 功能测试\n');
  console.log('═'.repeat(60));

  const test1 = await testOllamaConnection();
  const test2 = await testOpenAIFormat();

  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 测试结果:');
  console.log(`  评论生成测试: ${test1 ? '✅ 通过' : '❌ 失败'}`);
  console.log(`  格式兼容测试: ${test2 ? '✅ 通过' : '❌ 失败'}`);

  if (test1 && test2) {
    console.log('\n🎉 所有测试通过！可以在扩展中配置使用。');
    console.log('\n📝 扩展配置:');
    console.log(JSON.stringify({
      enable_llm_comment: true,
      llm_provider: 'custom',
      llm_api_key: 'ollama',
      llm_model: MODEL,
      llm_custom_endpoint: OLLAMA_ENDPOINT
    }, null, 2));
  } else {
    console.log('\n⚠️  部分测试失败，请检查配置。');
    process.exit(1);
  }
}

main();
