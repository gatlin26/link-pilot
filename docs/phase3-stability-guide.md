# 阶段3：稳定性增强功能使用指南

## 概述

阶段3 实现了以下稳定性增强功能：
1. 统一日志系统
2. 性能监控工具
3. 动态表单监听器
4. 单元测试框架

## 1. 统一日志系统

### 基本使用

```typescript
import { logger } from '@extension/shared';

// Debug 日志
logger.debug('调试信息', { data: 'some data' });

// Info 日志
logger.info('信息日志', { status: 'success' });

// Warn 日志
logger.warn('警告信息', { reason: 'timeout' });

// Error 日志
logger.error('错误信息', new Error('Something went wrong'), { context: 'form-detection' });
```

### 创建命名空间日志

```typescript
import { createLogger } from '@extension/shared';

const formLogger = createLogger('FormDetector');
formLogger.info('表单检测开始');
```

### 配置日志

```typescript
import { logger, LogLevel } from '@extension/shared';

// 更新配置
logger.configure({
  minLevel: LogLevel.WARN,  // 只显示 WARN 和 ERROR
  enabled: true,
  showTimestamp: true,
});

// 获取日志历史
const history = logger.getHistory();
const errors = logger.getHistory(LogLevel.ERROR);

// 导出日志
const jsonLog = logger.exportHistory();
```

## 2. 性能监控工具

### 基本使用

```typescript
import { performanceMonitor, MetricType } from '../utils/performance-monitor';

// 开始监控
const metricId = performanceMonitor.start(MetricType.FORM_DETECTION, undefined, {
  url: window.location.href,
});

// 执行操作
await detectForm();

// 结束监控
const duration = performanceMonitor.end(metricId);
console.log(`耗时: ${duration}ms`);
```

### 使用 measure 方法

```typescript
// 自动测量函数执行时间
const result = await performanceMonitor.measure(
  MetricType.FIELD_ANALYSIS,
  async () => {
    return await analyzeFields();
  },
  { fieldCount: 10 }
);
```

### 获取性能统计

```typescript
// 获取单个类型的统计
const stats = performanceMonitor.getStats(MetricType.FORM_DETECTION);
console.log(`平均耗时: ${stats.avgDuration}ms`);

// 获取所有统计
const allStats = performanceMonitor.getAllStats();

// 生成报告
const report = performanceMonitor.generateReport();
console.log(report);
```

### 内存监控

```typescript
// 监控内存使用
performanceMonitor.measureMemory();
```

## 3. 动态表单监听器

### 基本使用

```typescript
import { FormObserver } from './form-observer';

// 创建监听器
const observer = new FormObserver({
  debounceDelay: 500,
  watchAttributes: true,
  watchSubtree: true,
});

// 启动监听
observer.start((addedForms, addedFields) => {
  console.log(`检测到 ${addedForms.length} 个新表单`);
  console.log(`检测到 ${addedFields.length} 个新字段`);

  // 处理新表单
  handleNewForms(addedForms, addedFields);
});

// 停止监听
observer.stop();

// 销毁监听器
observer.destroy();
```

### 在 FormDetector 中使用

```typescript
import { formDetector } from './form-detector';

// 启动动态监听
formDetector.startObserving((result) => {
  if (result.detected) {
    console.log('检测到新表单', result);
    // 处理表单
  }
});

// 停止监听
formDetector.stopObserving();

// 销毁检测器
formDetector.destroy();
```

## 4. 单元测试

### 运行测试

```bash
# 安装 Vitest（如果还没安装）
pnpm add -D vitest @vitest/ui

# 运行测试
pnpm test

# 运行测试并查看覆盖率
pnpm test:coverage
```

### 测试文件位置

- `pages/content/src/form-handlers/__tests__/field-analyzer.test.ts`
- `pages/content/src/form-handlers/__tests__/fill-strategies.test.ts`
- `pages/content/src/form-handlers/__tests__/shadow-dom-detector.test.ts`

## 性能指标类型

```typescript
enum MetricType {
  FORM_DETECTION = 'form_detection',           // 表单检测
  FIELD_ANALYSIS = 'field_analysis',           // 字段分析
  FIELD_FILLING = 'field_filling',             // 字段填充
  SHADOW_DOM_DETECTION = 'shadow_dom_detection', // Shadow DOM 检测
  MEMORY_USAGE = 'memory_usage',               // 内存占用
}
```

## 最佳实践

### 1. 日志使用

- 开发环境：使用 DEBUG 和 INFO 级别
- 生产环境：只使用 WARN 和 ERROR 级别
- 错误日志必须包含错误对象和上下文信息

### 2. 性能监控

- 对关键操作进行性能监控
- 定期检查性能统计，优化慢操作
- 监控内存使用，避免内存泄漏

### 3. 动态监听

- 在页面加载完成后启动监听
- 在页面卸载前停止监听
- 使用合适的防抖延迟（推荐 500ms）

### 4. 资源清理

```typescript
// 在组件卸载时清理资源
window.addEventListener('beforeunload', () => {
  formDetector.destroy();
  performanceMonitor.destroy();
});
```

## 注意事项

1. **内存管理**：监听器和监控器会保存历史记录，定期清理避免内存泄漏
2. **性能影响**：日志和监控会有轻微性能开销，生产环境建议减少日志级别
3. **浏览器兼容性**：`performance.memory` API 仅在 Chrome 中可用
4. **防抖机制**：动态监听使用防抖避免频繁触发，可根据需要调整延迟

## 故障排查

### 日志不显示

检查日志配置：
```typescript
logger.configure({ enabled: true, minLevel: LogLevel.DEBUG });
```

### 性能监控无数据

确保调用了 `end()` 方法：
```typescript
const id = performanceMonitor.start(MetricType.FORM_DETECTION);
// ... 操作
performanceMonitor.end(id); // 必须调用
```

### 动态监听不工作

检查监听器状态：
```typescript
console.log(observer.isRunning()); // 应该返回 true
```
