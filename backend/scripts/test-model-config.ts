/**
 * @file test-model-config.ts
 * @description 测试模型配置和映射关系
 * @usage pnpm tsx scripts/test-model-config.ts
 */

import {
  AI_MODELS,
  DEFAULT_MODEL,
  getEvolinkModelId,
  getModelAspectRatios,
  getModelByEvolinkId,
  getModelById,
} from '../src/config/ai-models-config';

console.log('🧪 测试模型配置\n');

// 1. 测试模型列表
console.log('📋 可用模型列表:');
console.log('─'.repeat(80));
for (const model of AI_MODELS) {
  console.log(`✓ ${model.name} (${model.id})`);
  console.log(`  EvoLink 模型: ${model.evolinkModel}`);
  console.log(`  标签: ${model.tagKeys.join(', ')}`);
  console.log(`  时长: ${model.duration}`);
  console.log(`  宽高比: ${model.aspectRatios.join(', ')}`);
  if (model.qualities) {
    console.log(`  质量选项: ${model.qualities.join(', ')}`);
  }
  if (model.maxInputImages) {
    console.log(`  最大输入图片: ${model.maxInputImages}`);
  }
  console.log('');
}

// 2. 测试默认模型
console.log('🎯 默认模型:');
console.log('─'.repeat(80));
console.log(`${DEFAULT_MODEL.name} (${DEFAULT_MODEL.id})`);
console.log('');

// 3. 测试模型 ID 映射
console.log('🔄 模型 ID 映射测试:');
console.log('─'.repeat(80));

const testCases = [
  { frontendId: 'nano-banana', expectedEvolink: 'gemini-2.5-flash-image' },
  { frontendId: 'nano-banana-pro', expectedEvolink: 'nano-banana-2-lite' },
  { frontendId: 'seedream-4.5', expectedEvolink: 'doubao-seedream-4.5' },
  { frontendId: 'z-image-turbo', expectedEvolink: 'z-image-turbo' },
  { frontendId: 'invalid-model', expectedEvolink: null },
];

let passedTests = 0;
let failedTests = 0;

for (const test of testCases) {
  const result = getEvolinkModelId(test.frontendId);
  const passed = result === test.expectedEvolink;

  if (passed) {
    console.log(`✅ ${test.frontendId} → ${result}`);
    passedTests++;
  } else {
    console.log(
      `❌ ${test.frontendId} → ${result} (期望: ${test.expectedEvolink})`
    );
    failedTests++;
  }
}

console.log('');

// 4. 测试反向映射
console.log('🔙 反向映射测试:');
console.log('─'.repeat(80));

const reverseTestCases = [
  { evolinkId: 'gemini-2.5-flash-image', expectedFrontend: 'nano-banana' },
  { evolinkId: 'nano-banana-2-lite', expectedFrontend: 'nano-banana-pro' },
  { evolinkId: 'doubao-seedream-4.5', expectedFrontend: 'seedream-4.5' },
  { evolinkId: 'z-image-turbo', expectedFrontend: 'z-image-turbo' },
  { evolinkId: 'invalid-model', expectedFrontend: null },
];

for (const test of reverseTestCases) {
  const result = getModelByEvolinkId(test.evolinkId);
  const passed =
    (result === null && test.expectedFrontend === null) ||
    result?.id === test.expectedFrontend;

  if (passed) {
    console.log(`✅ ${test.evolinkId} → ${result?.id ?? 'null'}`);
    passedTests++;
  } else {
    console.log(
      `❌ ${test.evolinkId} → ${result?.id ?? 'null'} (期望: ${test.expectedFrontend})`
    );
    failedTests++;
  }
}

console.log('');

// 5. 测试宽高比获取
console.log('📐 宽高比获取测试:');
console.log('─'.repeat(80));

for (const model of AI_MODELS) {
  const ratios = getModelAspectRatios(model.id);
  const passed =
    ratios.length > 0 && ratios.every((r) => model.aspectRatios.includes(r));

  if (passed) {
    console.log(`✅ ${model.id}: ${ratios.length} 个宽高比`);
    passedTests++;
  } else {
    console.log(`❌ ${model.id}: 宽高比获取失败`);
    failedTests++;
  }
}

// 测试无效模型
const invalidRatios = getModelAspectRatios('invalid-model');
if (invalidRatios.length === 1 && invalidRatios[0] === '1:1') {
  console.log('✅ invalid-model: 返回默认宽高比 [1:1]');
  passedTests++;
} else {
  console.log('❌ invalid-model: 应返回默认宽高比 [1:1]');
  failedTests++;
}

console.log('');

// 6. 测试模型查询
console.log('🔍 模型查询测试:');
console.log('─'.repeat(80));

for (const model of AI_MODELS) {
  const result = getModelById(model.id);
  const passed = result?.id === model.id;

  if (passed) {
    console.log(`✅ ${model.id}: 查询成功`);
    passedTests++;
  } else {
    console.log(`❌ ${model.id}: 查询失败`);
    failedTests++;
  }
}

const invalidModel = getModelById('invalid-model');
if (invalidModel === null) {
  console.log('✅ invalid-model: 返回 null');
  passedTests++;
} else {
  console.log('❌ invalid-model: 应返回 null');
  failedTests++;
}

console.log('');

// 7. 总结
console.log('📊 测试结果:');
console.log('─'.repeat(80));
console.log(`✅ 通过: ${passedTests}`);
console.log(`❌ 失败: ${failedTests}`);
console.log(`📈 总计: ${passedTests + failedTests}`);
console.log('');

if (failedTests === 0) {
  console.log('🎉 所有测试通过！');
  process.exit(0);
} else {
  console.log('⚠️  部分测试失败，请检查配置');
  process.exit(1);
}
