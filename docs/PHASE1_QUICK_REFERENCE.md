# Phase 1 快速参考

## 新增的核心类和接口

### 1. ConfidenceCalculator（置信度计算器）
```typescript
import { confidenceCalculator } from '@/form-handlers';

// 决定填充行为
const behavior = confidenceCalculator.decideBehavior(confidence, 0.9, 0.6);

// 获取置信度等级
const level = confidenceCalculator.getConfidenceLevel(confidence);

// 计算表单置信度
const confidence = confidenceCalculator.calculateFormConfidence(
  fields,
  template,
  historicalSuccessRate
);

// 计算模板置信度
const templateConfidence = confidenceCalculator.calculateTemplateConfidence(
  'user_assisted',
  usageCount,
  successCount
);
```

### 2. FormFillOrchestrator（表单填充编排器）
```typescript
import { formFillOrchestrator } from '@/form-handlers';

// 自动填充流程
const result = await formFillOrchestrator.orchestrate(fillData, autoSubmit);

// 手动填充
const result = await formFillOrchestrator.manualFill(fillData, autoSubmit);

// 撤销填充
if (formFillOrchestrator.canUndo()) {
  formFillOrchestrator.undo();
}
```

### 3. AutoFillService（增强版）
```typescript
import { autoFillService } from '@/form-handlers';

// 决定是否填充
const decision = await autoFillService.decideFill(confidence);

// 填充表单
const result = await autoFillService.fill(fields, data, autoSubmit);

// 撤销
autoFillService.undo();
```

### 4. TemplateLearner（增强版）
```typescript
import { templateLearner } from '@/template';

// 从当前页面学习（指定学习来源）
const result = await templateLearner.learnFromCurrentPage(
  fields,
  'user_assisted'
);
```

### 5. TemplateStorage（增强版）
```typescript
import { templateStorage } from '@extension/storage';

// 记录模板使用
await templateStorage.recordUsage(templateId, success);

// 获取成功率
const successRate = await templateStorage.getSuccessRate(templateId);
```

## 新增的枚举和类型

### ConfidenceLevel
```typescript
enum ConfidenceLevel {
  HIGH = 'high',      // > 0.9
  MEDIUM = 'medium',  // 0.6 - 0.9
  LOW = 'low'         // < 0.6
}
```

### AutoFillBehavior
```typescript
enum AutoFillBehavior {
  AUTO_FILL = 'auto_fill',           // 自动填充
  PROMPT_USER = 'prompt_user',       // 提示用户
  MANUAL_ONLY = 'manual_only'        // 仅手动
}
```

### FillDecision
```typescript
interface FillDecision {
  behavior: AutoFillBehavior;
  confidenceLevel: ConfidenceLevel;
  confidence: number;
  shouldAutoFill: boolean;
  shouldPromptUser: boolean;
}
```

### OrchestrationResult
```typescript
interface OrchestrationResult {
  detected: boolean;
  confidence: number;
  behavior: 'auto_fill' | 'prompt_user' | 'manual_only';
  autoFilled: boolean;
  fillResult?: {
    success: boolean;
    filledFields: string[];
    failedFields: string[];
  };
  error?: string;
}
```

## 新增的配置项

```typescript
interface ExtensionSettings {
  // 现有配置...

  // 新增配置
  auto_fill_confidence_threshold?: number;      // 默认 0.9
  prompt_confidence_threshold?: number;         // 默认 0.6
  enable_assisted_learning?: boolean;           // 默认 true
  show_field_mapping_preview?: boolean;         // 默认 false
  auto_save_template_after_fill?: boolean;      // 默认 true
}
```

## 扩展的数据模型

### SiteTemplate（新增字段）
```typescript
interface SiteTemplate {
  // 现有字段...

  // 新增字段
  learning_source?: 'auto' | 'user_assisted';
  usage_count?: number;
  success_count?: number;
  last_used_at?: string;
  confidence_score?: number;
}
```

## 常见使用场景

### 场景 1：页面加载时自动检测和填充
```typescript
// 在 content script 中
async function onPageLoad() {
  const fillData = await getFillDataFromProfile();
  const result = await formFillOrchestrator.orchestrate(fillData);

  if (result.autoFilled) {
    showSuccessToast('已自动填充表单');
  } else if (result.behavior === 'prompt_user') {
    showPromptDialog(result.confidence);
  }
}
```

### 场景 2：用户点击填充按钮
```typescript
async function onFillButtonClick() {
  const fillData = await getFillDataFromProfile();
  const result = await formFillOrchestrator.manualFill(fillData);

  if (result.fillResult?.success) {
    showSuccessToast('填充成功', {
      showUndo: true
    });
  }
}
```

### 场景 3：用户点击撤销按钮
```typescript
function onUndoButtonClick() {
  if (formFillOrchestrator.canUndo()) {
    const success = formFillOrchestrator.undo();
    if (success) {
      showSuccessToast('已撤销填充');
    }
  }
}
```

### 场景 4：调整置信度阈值
```typescript
async function updateThresholds(autoFill: number, prompt: number) {
  await extensionSettingsStorage.updateSettings({
    auto_fill_confidence_threshold: autoFill,
    prompt_confidence_threshold: prompt,
  });
}
```

### 场景 5：查看模板统计
```typescript
async function showTemplateStats() {
  const templates = await templateStorage.getAll();

  for (const template of templates) {
    const successRate = await templateStorage.getSuccessRate(template.id);
    console.log(`${template.domain}: ${(successRate * 100).toFixed(1)}%`);
  }
}
```

## 调试技巧

### 1. 查看检测结果
```typescript
const detection = await formDetector.detect();
console.log('检测结果:', {
  detected: detection.detected,
  confidence: detection.confidence,
  fields: detection.fields.map(f => f.type),
  template: detection.template?.id,
});
```

### 2. 查看填充决策
```typescript
const decision = await autoFillService.decideFill(confidence);
console.log('填充决策:', {
  behavior: decision.behavior,
  level: decision.confidenceLevel,
  shouldAutoFill: decision.shouldAutoFill,
  shouldPromptUser: decision.shouldPromptUser,
});
```

### 3. 测试置信度计算
```typescript
const testConfidence = 0.75;
const behavior = confidenceCalculator.decideBehavior(testConfidence);
const level = confidenceCalculator.getConfidenceLevel(testConfidence);
console.log(`置信度 ${testConfidence}: ${level} -> ${behavior}`);
```

## 性能优化建议

1. **缓存检测结果**
   ```typescript
   let cachedDetection: FormDetectionResult | null = null;

   async function getDetection() {
     if (!cachedDetection) {
       cachedDetection = await formDetector.detect();
     }
     return cachedDetection;
   }
   ```

2. **防抖处理**
   ```typescript
   const debouncedDetect = debounce(async () => {
     await formDetector.detect();
   }, 500);
   ```

3. **批量更新模板统计**
   ```typescript
   // 收集多次使用后批量更新
   const usageQueue: Array<{ id: string; success: boolean }> = [];

   async function flushUsageQueue() {
     for (const usage of usageQueue) {
       await templateStorage.recordUsage(usage.id, usage.success);
     }
     usageQueue.length = 0;
   }
   ```

## 故障排查

### 问题：自动填充没有触发
1. 检查置信度是否达到阈值
2. 检查配置项 `auto_start_fill` 是否启用
3. 查看控制台是否有错误

### 问题：置信度过低
1. 检查是否有匹配的模板
2. 查看字段检测结果
3. 考虑手动创建模板

### 问题：撤销不工作
1. 确认填充操作已完成
2. 检查 `canUndo()` 返回值
3. 查看是否有错误日志

## 相关文档

- [详细实现文档](./phase1-implementation.md)
- [使用指南](./PHASE1_README.md)
- [实现总结](./PHASE1_SUMMARY.md)
