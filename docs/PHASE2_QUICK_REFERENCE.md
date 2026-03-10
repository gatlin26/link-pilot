# Phase 2 快速参考 - 用户辅助学习

## 核心 API

### AssistedLearningService

```typescript
import { assistedLearningService } from '@/form-handlers';

// 开始监听用户填充
assistedLearningService.startMonitoring();

// 停止监听
assistedLearningService.stopMonitoring();

// 获取当前会话
const session = assistedLearningService.getCurrentSession();

// 确认字段映射
assistedLearningService.confirmFieldMapping(element, 'email');

// 保存模板
const success = await assistedLearningService.saveTemplate();

// 取消学习
assistedLearningService.cancelLearning();
```

### FieldTypeInferrer

```typescript
import { fieldTypeInferrer } from '@/form-handlers';

// 推断单个字段
const result = fieldTypeInferrer.infer({
  element: inputElement,
  value: 'zhangsan@example.com',
  selector: 'input[name="email"]',
});

// 批量推断
const results = fieldTypeInferrer.inferBatch(fields);
```

## 事件监听

### 检测完成事件

```typescript
window.addEventListener('assisted-learning-detected', (event) => {
  const { sessionId, fieldCount } = event.detail;
  console.log(`检测到 ${fieldCount} 个字段`);

  // 显示学习提示 UI
  showLearnPrompt();
});
```

### 学习完成事件

```typescript
window.addEventListener('assisted-learning-completed', (event) => {
  const { sessionId, templateId, isNew } = event.detail;
  console.log(`模板${isNew ? '已创建' : '已更新'}: ${templateId}`);

  // 显示成功提示
  showSuccessToast('模板已保存');
});
```

## React 组件

### LearnTemplatePrompt

```typescript
import { LearnTemplatePrompt } from '@/components';

<LearnTemplatePrompt
  visible={showPrompt}
  detectedFields={detectedFields}
  onSave={handleSave}
  onCancel={handleCancel}
  onEditField={handleEditField}
/>
```

## 数据类型

### LearningState

```typescript
enum LearningState {
  IDLE = 'idle',              // 空闲
  MONITORING = 'monitoring',  // 监听中
  DETECTED = 'detected',      // 检测完成
  CONFIRMING = 'confirming',  // 等待确认
  LEARNING = 'learning',      // 学习中
  COMPLETED = 'completed',    // 完成
}
```

### FieldType

```typescript
type FieldType =
  | 'name'      // 姓名
  | 'email'     // 邮箱
  | 'website'   // 网站
  | 'comment'   // 评论
  | 'submit'    // 提交按钮
  | 'unknown';  // 未知
```

### DetectedField

```typescript
interface DetectedField {
  element: HTMLElement;
  value: string;
  selector: string;
  inferredType: FieldType;
  confidence: number;
  reasons: string[];
  confirmedType?: FieldType;
}
```

### InferenceResult

```typescript
interface InferenceResult {
  fieldType: FieldType;
  confidence: number;
  reasons: string[];
}
```

## 常见使用场景

### 场景 1：页面初始化

```typescript
// 在 content script 入口
import { assistedLearningService } from '@/form-handlers';

// 页面加载完成后
window.addEventListener('load', () => {
  assistedLearningService.startMonitoring();
});

// 页面卸载前
window.addEventListener('beforeunload', () => {
  assistedLearningService.stopMonitoring();
});
```

### 场景 2：显示学习提示

```typescript
import { useState, useEffect } from 'react';
import { assistedLearningService } from '@/form-handlers';
import { LearnTemplatePrompt } from '@/components';

function App() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    const handler = () => {
      const currentSession = assistedLearningService.getCurrentSession();
      setSession(currentSession);
      setShowPrompt(true);
    };

    window.addEventListener('assisted-learning-detected', handler);
    return () => window.removeEventListener('assisted-learning-detected', handler);
  }, []);

  return (
    <LearnTemplatePrompt
      visible={showPrompt}
      detectedFields={session?.detectedFields || []}
      onSave={async () => {
        await assistedLearningService.saveTemplate();
        setShowPrompt(false);
      }}
      onCancel={() => {
        assistedLearningService.cancelLearning();
        setShowPrompt(false);
      }}
      onEditField={(element, newType) => {
        assistedLearningService.confirmFieldMapping(element, newType);
        // 更新 UI
        setSession(assistedLearningService.getCurrentSession());
      }}
    />
  );
}
```

### 场景 3：手动触发学习

```typescript
// 用户点击"记录此表单"按钮
async function onRecordForm() {
  const session = assistedLearningService.getCurrentSession();

  if (!session || session.detectedFields.length === 0) {
    alert('请先填充表单');
    return;
  }

  const success = await assistedLearningService.saveTemplate();

  if (success) {
    showSuccessToast('模板已保存');
  } else {
    showErrorToast('保存失败');
  }
}
```

### 场景 4：查看学习状态

```typescript
function showLearningStatus() {
  const session = assistedLearningService.getCurrentSession();

  if (!session) {
    console.log('未开始学习');
    return;
  }

  console.log('学习状态:', session.state);
  console.log('检测到的字段:', session.detectedFields.length);

  session.detectedFields.forEach((field, index) => {
    console.log(`字段 ${index + 1}:`);
    console.log(`  类型: ${field.inferredType}`);
    console.log(`  置信度: ${(field.confidence * 100).toFixed(0)}%`);
    console.log(`  值: ${field.value.substring(0, 20)}...`);
  });
}
```

### 场景 5：测试字段推断

```typescript
import { fieldTypeInferrer } from '@/form-handlers';

// 测试邮箱推断
const emailResult = fieldTypeInferrer.infer({
  element: document.querySelector('input[name="email"]'),
  value: 'test@example.com',
  selector: 'input[name="email"]',
});

console.log('邮箱推断:', emailResult);
// { fieldType: 'email', confidence: 0.95, reasons: ['匹配邮箱格式'] }

// 测试 URL 推断
const urlResult = fieldTypeInferrer.infer({
  element: document.querySelector('input[name="website"]'),
  value: 'https://example.com',
  selector: 'input[name="website"]',
});

console.log('URL 推断:', urlResult);
// { fieldType: 'website', confidence: 0.95, reasons: ['匹配 URL 格式'] }
```

## 配置选项

### 启用/禁用用户辅助学习

```typescript
import { extensionSettingsStorage } from '@extension/storage';

// 禁用用户辅助学习
await extensionSettingsStorage.updateSettings({
  enable_assisted_learning: false,
});

// 启用用户辅助学习
await extensionSettingsStorage.updateSettings({
  enable_assisted_learning: true,
});
```

### 自动保存模板

```typescript
// 禁用自动保存（需要用户手动确认）
await extensionSettingsStorage.updateSettings({
  auto_save_template_after_fill: false,
});
```

## 调试技巧

### 1. 查看监听状态

```typescript
const session = assistedLearningService.getCurrentSession();
console.log('当前状态:', session?.state);
console.log('检测到的字段数:', session?.detectedFields.length);
```

### 2. 查看推断详情

```typescript
session?.detectedFields.forEach(field => {
  console.log('字段:', field.selector);
  console.log('推断类型:', field.inferredType);
  console.log('置信度:', field.confidence);
  console.log('推断依据:', field.reasons);
  console.log('---');
});
```

### 3. 测试推断算法

```typescript
// 创建测试字段
const testField = {
  element: document.createElement('input'),
  value: 'test@example.com',
  selector: 'input[name="test"]',
};

// 推断类型
const result = fieldTypeInferrer.infer(testField);
console.log('推断结果:', result);
```

### 4. 模拟用户填充

```typescript
// 手动触发字段变更
const input = document.querySelector('input[name="email"]');
input.value = 'test@example.com';
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
```

## 性能优化

### 1. 限制监听范围

```typescript
// 只监听特定表单
const form = document.querySelector('#comment-form');
if (form) {
  // 只监听这个表单
}
```

### 2. 防抖处理

```typescript
// 避免频繁触发推断
let debounceTimer;
element.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // 执行推断
  }, 300);
});
```

### 3. 批量处理

```typescript
// 收集所有字段后一次性推断
const fields = collectAllFields();
const results = fieldTypeInferrer.inferBatch(fields);
```

## 故障排查

### 问题：没有触发检测完成事件

**可能原因：**
1. 填充的字段数量不足（< 2 个）
2. 缺少必要字段（评论 + 姓名/邮箱）
3. 监听未启动

**解决方法：**
```typescript
// 检查监听状态
const session = assistedLearningService.getCurrentSession();
console.log('状态:', session?.state);
console.log('字段数:', session?.detectedFields.length);

// 手动触发检测
if (session && session.detectedFields.length >= 2) {
  window.dispatchEvent(new CustomEvent('assisted-learning-detected', {
    detail: { sessionId: session.id, fieldCount: session.detectedFields.length }
  }));
}
```

### 问题：推断类型不准确

**可能原因：**
1. 字段值格式不明显
2. 字段属性缺少关键词
3. 需要用户确认

**解决方法：**
```typescript
// 查看推断依据
const field = session.detectedFields[0];
console.log('推断依据:', field.reasons);

// 手动修正
assistedLearningService.confirmFieldMapping(field.element, 'email');
```

### 问题：模板保存失败

**可能原因：**
1. 配置禁用了学习功能
2. 字段数量不足
3. 存储空间不足

**解决方法：**
```typescript
// 检查配置
const settings = await extensionSettingsStorage.get();
console.log('学习功能启用:', settings.enable_assisted_learning);

// 检查字段
const session = assistedLearningService.getCurrentSession();
console.log('有效字段数:', session?.detectedFields.filter(f =>
  f.inferredType !== 'unknown' && f.inferredType !== 'submit'
).length);
```

## 最佳实践

1. **及时启动监听**：在页面加载完成后立即启动
2. **合理的提示时机**：等待用户完成填充后再提示
3. **清晰的 UI 反馈**：让用户知道系统在做什么
4. **允许用户修正**：提供编辑字段类型的功能
5. **保护用户隐私**：不记录敏感字段

## 相关文档

- [详细实现文档](./phase2-implementation.md)
- [Phase 1 快速参考](./PHASE1_QUICK_REFERENCE.md)
- [完整设计方案](../智能表单自动填充功能设计方案.md)
