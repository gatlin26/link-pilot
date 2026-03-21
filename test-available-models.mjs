#!/usr/bin/env node

/**
 * 测试可用的 Claude 模型
 */

const API_KEY = 'sk-z0ZuQ5gq90GRH9jlwgZzhVRac7TBbDBhO4yCFHgT424zSblD';
const ENDPOINT = 'https://api.yunnet.top/v1/messages';

// 尝试不同的模型名称
const MODELS_TO_TRY = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet',
  'claude-3-sonnet-20240229',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
  'claude-sonnet-4.5',
  'claude-4.5',
];

async function testModel(model) {
  const prompt = '请用一句话介绍你自己。';

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.content[0]?.text || '';
      return { success: true, text };
    } else {
      const error = await response.json();
      return { success: false, error: error.error?.message || response.statusText };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔍 测试可用的 Claude 模型\n');
  console.log('═'.repeat(60));
  console.log(`端点: ${ENDPOINT}`);
  console.log(`API Key: ${API_KEY.substring(0, 15)}...`);
  console.log('═'.repeat(60) + '\n');

  for (const model of MODELS_TO_TRY) {
    process.stdout.write(`测试 ${model.padEnd(35)} ... `);

    const result = await testModel(model);

    if (result.success) {
      console.log('✅ 可用');
      console.log(`   响应: ${result.text.substring(0, 50)}...`);

      console.log('\n🎉 找到可用模型！');
      console.log('\n📝 扩展配置:');
      console.log(JSON.stringify({
        enable_llm_comment: true,
        llm_provider: 'anthropic',
        llm_api_key: API_KEY,
        llm_model: model,
        llm_custom_endpoint: ENDPOINT,
      }, null, 2));

      return;
    } else {
      console.log(`❌ 不可用`);
      console.log(`   错误: ${result.error}`);
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n⚠️  未找到可用模型，请联系 API 提供商确认可用的模型列表。');
}

main();
