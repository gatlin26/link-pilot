/**
 * Phase 1 功能集成测试示例
 *
 * 这个文件展示如何测试新实现的智能表单填充功能
 */

import { formFillOrchestrator } from '../form-handlers/form-fill-orchestrator';
import { formDetector } from '../form-handlers/form-detector';
import { confidenceCalculator } from '../form-handlers/confidence-calculator';
import { templateStorage } from '@extension/storage';
import { extensionSettingsStorage } from '@extension/storage';

/**
 * 测试场景 1: 高置信度自动填充
 */
async function testHighConfidenceAutoFill() {
  console.log('=== 测试场景 1: 高置信度自动填充 ===');

  // 准备测试数据
  const fillData = {
    name: '张三',
    email: 'zhangsan@example.com',
    website: 'https://example.com',
    comment: '很棒的文章，感谢分享！',
  };

  // 执行自动填充
  const result = await formFillOrchestrator.orchestrate(fillData, false);

  console.log('检测结果:', result.detected);
  console.log('置信度:', result.confidence);
  console.log('行为:', result.behavior);
  console.log('是否自动填充:', result.autoFilled);

  if (result.autoFilled && result.fillResult) {
    console.log('填充成功:', result.fillResult.success);
    console.log('已填充字段:', result.fillResult.filledFields);
    console.log('失败字段:', result.fillResult.failedFields);
  }

  // 测试撤销功能
  if (formFillOrchestrator.canUndo()) {
    console.log('可以撤销');
    const undoSuccess = formFillOrchestrator.undo();
    console.log('撤销成功:', undoSuccess);
  }
}

/**
 * 测试场景 2: 中等置信度提示用户
 */
async function testMediumConfidencePrompt() {
  console.log('=== 测试场景 2: 中等置信度提示用户 ===');

  // 检测表单
  const detection = await formDetector.detect();

  if (detection.detected) {
    console.log('检测到表单');
    console.log('页面类型:', detection.pageType);
    console.log('字段数量:', detection.fields.length);
    console.log('置信度:', detection.confidence);

    // 计算置信度等级
    const level = confidenceCalculator.getConfidenceLevel(detection.confidence);
    console.log('置信度等级:', level);

    // 如果是中等置信度，应该提示用户
    if (level === 'medium') {
      console.log('应该显示提示框让用户确认');

      // 模拟用户点击"填充"按钮
      const fillData = {
        name: '李四',
        email: 'lisi@example.com',
        website: 'https://lisi.com',
        comment: '非常有用的内容！',
      };

      const result = await formFillOrchestrator.manualFill(fillData, false);
      console.log('手动填充结果:', result);
    }
  }
}

/**
 * 测试场景 3: 模板统计功能
 */
async function testTemplateStatistics() {
  console.log('=== 测试场景 3: 模板统计功能 ===');

  // 获取所有模板
  const templates = await templateStorage.getAll();
  console.log('模板总数:', templates.length);

  for (const template of templates) {
    console.log('\n模板信息:');
    console.log('  域名:', template.domain);
    console.log('  学习来源:', template.learning_source);
    console.log('  使用次数:', template.usage_count || 0);
    console.log('  成功次数:', template.success_count || 0);
    console.log('  置信度:', template.confidence_score || 0);

    // 计算成功率
    const successRate = await templateStorage.getSuccessRate(template.id);
    console.log('  成功率:', (successRate * 100).toFixed(1) + '%');
  }
}

/**
 * 测试场景 4: 配置项测试
 */
async function testSettings() {
  console.log('=== 测试场景 4: 配置项测试 ===');

  // 获取当前设置
  const settings = await extensionSettingsStorage.get();

  console.log('当前配置:');
  console.log('  自动填充阈值:', settings.auto_fill_confidence_threshold);
  console.log('  提示阈值:', settings.prompt_confidence_threshold);
  console.log('  启用辅助学习:', settings.enable_assisted_learning);
  console.log('  自动保存模板:', settings.auto_save_template_after_fill);

  // 测试修改配置
  await extensionSettingsStorage.updateSettings({
    auto_fill_confidence_threshold: 0.85,
    prompt_confidence_threshold: 0.5,
  });

  console.log('\n已更新配置');

  // 验证更新
  const updatedSettings = await extensionSettingsStorage.get();
  console.log('新的自动填充阈值:', updatedSettings.auto_fill_confidence_threshold);
  console.log('新的提示阈值:', updatedSettings.prompt_confidence_threshold);
}

/**
 * 测试场景 5: 置信度计算测试
 */
async function testConfidenceCalculation() {
  console.log('=== 测试场景 5: 置信度计算测试 ===');

  // 测试不同置信度的行为决策
  const testCases = [
    { confidence: 0.95, expected: 'auto_fill' },
    { confidence: 0.75, expected: 'prompt_user' },
    { confidence: 0.45, expected: 'manual_only' },
  ];

  for (const testCase of testCases) {
    const behavior = confidenceCalculator.decideBehavior(
      testCase.confidence,
      0.9,
      0.6
    );
    const level = confidenceCalculator.getConfidenceLevel(testCase.confidence);

    console.log(`\n置信度 ${testCase.confidence}:`);
    console.log('  等级:', level);
    console.log('  行为:', behavior);
    console.log('  预期:', testCase.expected);
    console.log('  匹配:', behavior === testCase.expected ? '✓' : '✗');
  }

  // 测试模板置信度计算
  console.log('\n模板置信度计算:');

  const autoConfidence = confidenceCalculator.calculateTemplateConfidence('auto', 0, 0);
  console.log('  自动学习（新模板）:', autoConfidence);

  const userConfidence = confidenceCalculator.calculateTemplateConfidence('user_assisted', 0, 0);
  console.log('  用户辅助（新模板）:', userConfidence);

  const experiencedConfidence = confidenceCalculator.calculateTemplateConfidence('auto', 10, 9);
  console.log('  自动学习（10次使用，9次成功）:', experiencedConfidence);
}

/**
 * 运行所有测试
 */
export async function runAllTests() {
  console.log('开始运行 Phase 1 功能测试\n');

  try {
    await testHighConfidenceAutoFill();
    console.log('\n');

    await testMediumConfidencePrompt();
    console.log('\n');

    await testTemplateStatistics();
    console.log('\n');

    await testSettings();
    console.log('\n');

    await testConfidenceCalculation();
    console.log('\n');

    console.log('所有测试完成！');
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 如果直接运行此文件
if (typeof window !== 'undefined') {
  // 在浏览器环境中，可以通过控制台调用
  (window as any).runPhase1Tests = runAllTests;
  console.log('测试函数已加载，可以通过 runPhase1Tests() 运行');
}
