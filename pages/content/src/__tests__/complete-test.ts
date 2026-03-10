/**
 * 完整功能测试脚本
 * 测试 Phase 1 和 Phase 2 的所有功能
 */

import { formDetector } from '../form-handlers/form-detector';
import { autoFillService } from '../form-handlers/auto-fill-service';
import { confidenceCalculator, ConfidenceLevel, AutoFillBehavior } from '../form-handlers/confidence-calculator';
import { formFillOrchestrator } from '../form-handlers/form-fill-orchestrator';
import { fieldTypeInferrer } from '../form-handlers/field-type-inferrer';
import { assistedLearningService, LearningState } from '../form-handlers/assisted-learning';
import { templateStorage } from '@extension/storage';
import { extensionSettingsStorage } from '@extension/storage';

/**
 * 测试结果
 */
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

/**
 * 测试套件
 */
class TestSuite {
  private results: TestResult[] = [];

  /**
   * 运行测试
   */
  async run(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({
        name,
        passed: true,
        message: '通过',
        duration,
      });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      this.results.push({
        name,
        passed: false,
        message,
        duration,
      });
      console.error(`❌ ${name} (${duration}ms)`);
      console.error(`   错误: ${message}`);
    }
  }

  /**
   * 断言
   */
  assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * 断言相等
   */
  assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        message || `期望 ${expected}，实际 ${actual}`
      );
    }
  }

  /**
   * 断言大于
   */
  assertGreaterThan(actual: number, expected: number, message?: string): void {
    if (actual <= expected) {
      throw new Error(
        message || `期望 > ${expected}，实际 ${actual}`
      );
    }
  }

  /**
   * 打印总结
   */
  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('测试总结');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`总计: ${total} 个测试`);
    console.log(`通过: ${passed} 个 (${((passed / total) * 100).toFixed(1)}%)`);
    console.log(`失败: ${failed} 个 (${((failed / total) * 100).toFixed(1)}%)`);
    console.log(`总耗时: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\n失败的测试:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  ❌ ${r.name}`);
          console.log(`     ${r.message}`);
        });
    }

    console.log('='.repeat(60) + '\n');
  }
}

/**
 * Phase 1 测试
 */
async function testPhase1(suite: TestSuite): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('Phase 1: 智能混合触发模式测试');
  console.log('='.repeat(60) + '\n');

  // 测试 1: 置信度计算器 - 行为决策
  await suite.run('置信度计算器 - 行为决策', async () => {
    const highBehavior = confidenceCalculator.decideBehavior(0.95, 0.9, 0.6);
    suite.assertEqual(highBehavior, AutoFillBehavior.AUTO_FILL, '高置信度应该自动填充');

    const mediumBehavior = confidenceCalculator.decideBehavior(0.75, 0.9, 0.6);
    suite.assertEqual(mediumBehavior, AutoFillBehavior.PROMPT_USER, '中等置信度应该提示用户');

    const lowBehavior = confidenceCalculator.decideBehavior(0.45, 0.9, 0.6);
    suite.assertEqual(lowBehavior, AutoFillBehavior.MANUAL_ONLY, '低置信度应该仅手动');
  });

  // 测试 2: 置信度计算器 - 等级判断
  await suite.run('置信度计算器 - 等级判断', async () => {
    const highLevel = confidenceCalculator.getConfidenceLevel(0.95);
    suite.assertEqual(highLevel, ConfidenceLevel.HIGH, '0.95 应该是 HIGH');

    const mediumLevel = confidenceCalculator.getConfidenceLevel(0.75);
    suite.assertEqual(mediumLevel, ConfidenceLevel.MEDIUM, '0.75 应该是 MEDIUM');

    const lowLevel = confidenceCalculator.getConfidenceLevel(0.45);
    suite.assertEqual(lowLevel, ConfidenceLevel.LOW, '0.45 应该是 LOW');
  });

  // 测试 3: 置信度计算器 - 模板置信度
  await suite.run('置信度计算器 - 模板置信度', async () => {
    const userAssistedConfidence = confidenceCalculator.calculateTemplateConfidence(
      'user_assisted',
      0,
      0
    );
    suite.assertGreaterThan(userAssistedConfidence, 0.9, '用户辅助学习的初始置信度应该 > 0.9');

    const autoConfidence = confidenceCalculator.calculateTemplateConfidence('auto', 0, 0);
    suite.assertGreaterThan(autoConfidence, 0.6, '自动学习的初始置信度应该 > 0.6');

    const experiencedConfidence = confidenceCalculator.calculateTemplateConfidence(
      'auto',
      10,
      9
    );
    suite.assertGreaterThan(
      experiencedConfidence,
      autoConfidence,
      '有使用历史的模板置信度应该更高'
    );
  });

  // 测试 4: 扩展设置
  await suite.run('扩展设置 - 新配置项', async () => {
    const settings = await extensionSettingsStorage.get();

    suite.assert(
      typeof settings.auto_fill_confidence_threshold === 'number',
      '应该有 auto_fill_confidence_threshold 配置'
    );
    suite.assert(
      typeof settings.prompt_confidence_threshold === 'number',
      '应该有 prompt_confidence_threshold 配置'
    );
    suite.assert(
      typeof settings.enable_assisted_learning === 'boolean',
      '应该有 enable_assisted_learning 配置'
    );

    suite.assertEqual(
      settings.auto_fill_confidence_threshold,
      0.9,
      '默认自动填充阈值应该是 0.9'
    );
    suite.assertEqual(
      settings.prompt_confidence_threshold,
      0.6,
      '默认提示阈值应该是 0.6'
    );
  });

  // 测试 5: 自动填充服务 - 撤销功能
  await suite.run('自动填充服务 - 撤销功能', async () => {
    const canUndoBefore = autoFillService.canUndo();
    suite.assertEqual(canUndoBefore, false, '填充前不应该可以撤销');

    // 注意：实际的填充和撤销需要 DOM 环境，这里只测试接口
    suite.assert(typeof autoFillService.undo === 'function', '应该有 undo 方法');
    suite.assert(typeof autoFillService.canUndo === 'function', '应该有 canUndo 方法');
  });

  // 测试 6: 模板存储 - 统计功能
  await suite.run('模板存储 - 统计功能', async () => {
    suite.assert(
      typeof templateStorage.recordUsage === 'function',
      '应该有 recordUsage 方法'
    );
    suite.assert(
      typeof templateStorage.getSuccessRate === 'function',
      '应该有 getSuccessRate 方法'
    );
  });
}

/**
 * Phase 2 测试
 */
async function testPhase2(suite: TestSuite): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('Phase 2: 用户辅助学习机制测试');
  console.log('='.repeat(60) + '\n');

  // 测试 1: 字段类型推断 - 邮箱
  await suite.run('字段类型推断 - 邮箱', async () => {
    const result = fieldTypeInferrer.infer({
      element: document.createElement('input'),
      value: 'test@example.com',
      selector: 'input[name="email"]',
    });

    suite.assertEqual(result.fieldType, 'email', '应该识别为邮箱');
    suite.assertGreaterThan(result.confidence, 0.9, '邮箱识别置信度应该 > 0.9');
    suite.assert(result.reasons.length > 0, '应该有推断依据');
  });

  // 测试 2: 字段类型推断 - URL
  await suite.run('字段类型推断 - URL', async () => {
    const result = fieldTypeInferrer.infer({
      element: document.createElement('input'),
      value: 'https://example.com',
      selector: 'input[name="website"]',
    });

    suite.assertEqual(result.fieldType, 'website', '应该识别为网站');
    suite.assertGreaterThan(result.confidence, 0.9, 'URL 识别置信度应该 > 0.9');
  });

  // 测试 3: 字段类型推断 - 长文本
  await suite.run('字段类型推断 - 长文本', async () => {
    const longText = '这是一条很长的评论内容，超过了50个字符，应该被识别为评论字段。';
    const result = fieldTypeInferrer.infer({
      element: document.createElement('textarea'),
      value: longText,
      selector: 'textarea[name="comment"]',
    });

    suite.assertEqual(result.fieldType, 'comment', '应该识别为评论');
    suite.assertGreaterThan(result.confidence, 0.6, '评论识别置信度应该 > 0.6');
  });

  // 测试 4: 字段类型推断 - 姓名
  await suite.run('字段类型推断 - 姓名', async () => {
    const result = fieldTypeInferrer.infer({
      element: document.createElement('input'),
      value: '张三',
      selector: 'input[name="name"]',
    });

    suite.assertEqual(result.fieldType, 'name', '应该识别为姓名');
    suite.assertGreaterThan(result.confidence, 0.5, '姓名识别置信度应该 > 0.5');
  });

  // 测试 5: 字段类型推断 - 批量推断
  await suite.run('字段类型推断 - 批量推断', async () => {
    const fields = [
      {
        element: document.createElement('input'),
        value: 'test@example.com',
        selector: 'input[name="email"]',
      },
      {
        element: document.createElement('input'),
        value: 'https://example.com',
        selector: 'input[name="website"]',
      },
    ];

    const results = fieldTypeInferrer.inferBatch(fields);

    suite.assertEqual(results.size, 2, '应该返回 2 个结果');
    suite.assert(results instanceof Map, '应该返回 Map 对象');
  });

  // 测试 6: 用户辅助学习服务 - 基本接口
  await suite.run('用户辅助学习服务 - 基本接口', async () => {
    suite.assert(
      typeof assistedLearningService.startMonitoring === 'function',
      '应该有 startMonitoring 方法'
    );
    suite.assert(
      typeof assistedLearningService.stopMonitoring === 'function',
      '应该有 stopMonitoring 方法'
    );
    suite.assert(
      typeof assistedLearningService.saveTemplate === 'function',
      '应该有 saveTemplate 方法'
    );
    suite.assert(
      typeof assistedLearningService.cancelLearning === 'function',
      '应该有 cancelLearning 方法'
    );
  });

  // 测试 7: 用户辅助学习服务 - 会话管理
  await suite.run('用户辅助学习服务 - 会话管理', async () => {
    const sessionBefore = assistedLearningService.getCurrentSession();
    suite.assertEqual(sessionBefore, null, '初始状态应该没有会话');

    assistedLearningService.startMonitoring();
    const sessionAfter = assistedLearningService.getCurrentSession();
    suite.assert(sessionAfter !== null, '启动监听后应该有会话');
    suite.assertEqual(sessionAfter?.state, LearningState.MONITORING, '状态应该是 MONITORING');

    assistedLearningService.stopMonitoring();
  });
}

/**
 * 集成测试
 */
async function testIntegration(suite: TestSuite): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('集成测试');
  console.log('='.repeat(60) + '\n');

  // 测试 1: Phase 1 和 Phase 2 的集成
  await suite.run('Phase 1 和 Phase 2 集成', async () => {
    // 验证模块可以正常导入和使用
    suite.assert(typeof formDetector !== 'undefined', 'formDetector 应该可用');
    suite.assert(typeof autoFillService !== 'undefined', 'autoFillService 应该可用');
    suite.assert(
      typeof confidenceCalculator !== 'undefined',
      'confidenceCalculator 应该可用'
    );
    suite.assert(
      typeof formFillOrchestrator !== 'undefined',
      'formFillOrchestrator 应该可用'
    );
    suite.assert(typeof fieldTypeInferrer !== 'undefined', 'fieldTypeInferrer 应该可用');
    suite.assert(
      typeof assistedLearningService !== 'undefined',
      'assistedLearningService 应该可用'
    );
  });

  // 测试 2: 配置项完整性
  await suite.run('配置项完整性', async () => {
    const settings = await extensionSettingsStorage.get();

    // Phase 1 配置
    suite.assert('auto_fill_confidence_threshold' in settings, '应该有自动填充阈值配置');
    suite.assert('prompt_confidence_threshold' in settings, '应该有提示阈值配置');

    // Phase 2 配置
    suite.assert('enable_assisted_learning' in settings, '应该有启用辅助学习配置');
    suite.assert('auto_save_template_after_fill' in settings, '应该有自动保存模板配置');
  });

  // 测试 3: 性能测试
  await suite.run('性能测试 - 置信度计算', async () => {
    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      confidenceCalculator.decideBehavior(0.75, 0.9, 0.6);
    }
    const duration = Date.now() - startTime;

    suite.assert(duration < 100, `100 次置信度计算应该 < 100ms，实际 ${duration}ms`);
  });

  // 测试 4: 性能测试 - 字段推断
  await suite.run('性能测试 - 字段推断', async () => {
    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      fieldTypeInferrer.infer({
        element: document.createElement('input'),
        value: 'test@example.com',
        selector: 'input[name="email"]',
      });
    }
    const duration = Date.now() - startTime;

    suite.assert(duration < 500, `100 次字段推断应该 < 500ms，实际 ${duration}ms`);
  });
}

/**
 * 运行所有测试
 */
export async function runAllTests(): Promise<void> {
  console.log('\n' + '█'.repeat(60));
  console.log('智能表单自动填充功能 - 完整测试');
  console.log('█'.repeat(60));

  const suite = new TestSuite();

  try {
    await testPhase1(suite);
    await testPhase2(suite);
    await testIntegration(suite);
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }

  suite.printSummary();
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  (window as any).runAllTests = runAllTests;
  console.log('测试函数已加载，运行 runAllTests() 开始测试');
}
