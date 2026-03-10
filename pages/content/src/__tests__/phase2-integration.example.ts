/**
 * Phase 2 用户辅助学习集成示例
 * 展示如何使用用户辅助学习功能
 */

import { assistedLearningService, LearningState } from '../form-handlers/assisted-learning';
import type { DetectedField } from '../form-handlers/assisted-learning';
import type { FieldType } from '../form-handlers/field-type-inferrer';

/**
 * 初始化用户辅助学习
 */
export function initAssistedLearning() {
  // 监听检测完成事件
  window.addEventListener('assisted-learning-detected', (event: any) => {
    const { sessionId, fieldCount } = event.detail;
    console.log(`[AssistedLearning] 检测到 ${fieldCount} 个字段填充`);

    // 显示学习提示 UI
    showLearnPrompt();
  });

  // 监听学习完成事件
  window.addEventListener('assisted-learning-completed', (event: any) => {
    const { sessionId, templateId, isNew } = event.detail;
    console.log(`[AssistedLearning] 模板保存成功: ${templateId} (${isNew ? '新建' : '更新'})`);

    // 显示成功提示
    showSuccessToast(isNew ? '模板已保存' : '模板已更新');
  });

  // 开始监听
  assistedLearningService.startMonitoring();
}

/**
 * 显示学习提示
 */
function showLearnPrompt() {
  const session = assistedLearningService.getCurrentSession();
  if (!session || session.state !== LearningState.DETECTED) {
    return;
  }

  // 这里应该渲染 LearnTemplatePrompt 组件
  // 示例代码：
  console.log('[UI] 显示学习提示对话框');
  console.log('检测到的字段:', session.detectedFields);

  // 模拟用户交互
  // 实际应用中，这些操作由 UI 组件触发
}

/**
 * 用户点击"保存模板"
 */
export async function onSaveTemplate() {
  const success = await assistedLearningService.saveTemplate();

  if (success) {
    console.log('[AssistedLearning] 模板保存成功');
    // 停止监听
    assistedLearningService.stopMonitoring();
  } else {
    console.error('[AssistedLearning] 模板保存失败');
    showErrorToast('保存失败，请重试');
  }
}

/**
 * 用户点击"不保存"
 */
export function onCancelLearning() {
  assistedLearningService.cancelLearning();
  console.log('[AssistedLearning] 用户取消学习');
}

/**
 * 用户修改字段类型
 */
export function onEditFieldType(element: HTMLElement, newType: FieldType) {
  assistedLearningService.confirmFieldMapping(element, newType);
  console.log('[AssistedLearning] 用户修改字段类型:', newType);
}

/**
 * 显示成功提示
 */
function showSuccessToast(message: string) {
  // 实际应用中应该显示 Toast 组件
  console.log('[Toast] Success:', message);
}

/**
 * 显示错误提示
 */
function showErrorToast(message: string) {
  // 实际应用中应该显示 Toast 组件
  console.error('[Toast] Error:', message);
}

/**
 * 完整的使用示例
 */
export function exampleUsage() {
  console.log('=== Phase 2 用户辅助学习示例 ===\n');

  // 1. 页面加载时初始化
  console.log('1. 初始化用户辅助学习');
  initAssistedLearning();

  // 2. 用户开始填充表单
  console.log('\n2. 用户手动填充表单...');
  console.log('   - 填充姓名字段');
  console.log('   - 填充邮箱字段');
  console.log('   - 填充评论字段');

  // 3. 系统检测到填充完成
  console.log('\n3. 系统检测到完整的表单填充');
  console.log('   - 触发 assisted-learning-detected 事件');
  console.log('   - 显示学习提示对话框');

  // 4. 用户查看字段映射
  console.log('\n4. 用户查看识别到的字段');
  const session = assistedLearningService.getCurrentSession();
  if (session) {
    session.detectedFields.forEach((field, index) => {
      console.log(`   字段 ${index + 1}:`);
      console.log(`     - 类型: ${field.inferredType}`);
      console.log(`     - 置信度: ${(field.confidence * 100).toFixed(0)}%`);
      console.log(`     - 值: ${field.value.substring(0, 20)}...`);
    });
  }

  // 5. 用户修改字段类型（可选）
  console.log('\n5. 用户修改某个字段的类型（可选）');
  console.log('   - 将字段类型从 "name" 改为 "email"');

  // 6. 用户点击保存
  console.log('\n6. 用户点击"保存模板"');
  console.log('   - 调用 assistedLearningService.saveTemplate()');
  console.log('   - 保存模板到本地存储');
  console.log('   - 触发 assisted-learning-completed 事件');

  // 7. 显示成功提示
  console.log('\n7. 显示成功提示');
  console.log('   - "模板已保存"');
  console.log('   - 停止监听');

  console.log('\n=== 示例完成 ===');
}

/**
 * 测试字段类型推断
 */
export function testFieldInference() {
  console.log('=== 测试字段类型推断 ===\n');

  const testCases = [
    {
      value: 'zhangsan@example.com',
      expected: 'email',
    },
    {
      value: 'https://example.com',
      expected: 'website',
    },
    {
      value: '张三',
      expected: 'name',
    },
    {
      value: '这是一条很长的评论内容，超过了50个字符，应该被识别为评论字段。这里继续添加一些文字。',
      expected: 'comment',
    },
  ];

  testCases.forEach((testCase, index) => {
    console.log(`测试用例 ${index + 1}:`);
    console.log(`  输入: ${testCase.value.substring(0, 30)}...`);
    console.log(`  预期: ${testCase.expected}`);
    console.log('');
  });

  console.log('=== 测试完成 ===');
}

/**
 * 在浏览器控制台中可用的函数
 */
if (typeof window !== 'undefined') {
  (window as any).assistedLearningExample = {
    init: initAssistedLearning,
    save: onSaveTemplate,
    cancel: onCancelLearning,
    example: exampleUsage,
    testInference: testFieldInference,
    getSession: () => assistedLearningService.getCurrentSession(),
  };

  console.log('用户辅助学习示例已加载');
  console.log('可用函数:');
  console.log('  - assistedLearningExample.init()       // 初始化');
  console.log('  - assistedLearningExample.save()       // 保存模板');
  console.log('  - assistedLearningExample.cancel()     // 取消学习');
  console.log('  - assistedLearningExample.example()    // 运行示例');
  console.log('  - assistedLearningExample.testInference() // 测试推断');
  console.log('  - assistedLearningExample.getSession() // 获取当前会话');
}
