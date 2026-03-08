# Ahrefs 数据收集器使用指南

## 快速开始

### 1. 导入收集器

```typescript
import { collectorRegistry } from '@src/collectors';
```

### 2. 开始收集数据

```typescript
// 收集 10 条外链数据
const backlinks = await collectorRegistry.startCollection(10);

// 收集 20 条外链数据
const backlinks = await collectorRegistry.startCollection(20);
```

### 3. 处理收集的数据

```typescript
backlinks.forEach(backlink => {
  console.log({
    目标URL: backlink.target_url,
    引用URL: backlink.referring_page_url,
    锚文本: backlink.anchor_text,
    页面标题: backlink.page_title,
    域名评分: backlink.raw_metrics.domain_rating,
  });
});
```

## 完整示例

```typescript
import { collectorRegistry, isAhrefsBacklinkChecker } from '@src/collectors';

async function collectAhrefsData() {
  // 1. 检查当前页面是否支持
  if (!isAhrefsBacklinkChecker()) {
    console.log('当前页面不是 Ahrefs Backlink Checker');
    return;
  }

  try {
    // 2. 开始收集
    console.log('开始收集外链数据...');
    const backlinks = await collectorRegistry.startCollection(10);

    // 3. 收集成功
    console.log(`收集成功！共 ${backlinks.length} 条外链`);

    // 4. 保存数据
    await saveToLocalStorage(backlinks);

    // 5. 显示通知
    showNotification(`成功收集 ${backlinks.length} 条外链数据`);

  } catch (error) {
    console.error('收集失败:', error);
    showNotification('收集失败，请重试');
  }
}

// 保存到本地存储
async function saveToLocalStorage(backlinks) {
  const key = `backlinks_${Date.now()}`;
  await chrome.storage.local.set({ [key]: backlinks });
}

// 显示通知
function showNotification(message) {
  // 实现通知逻辑
}
```

## API 参考

### collectorRegistry

收集器注册表，管理所有平台的数据收集器。

#### 方法

##### `startCollection(maxCount: number): Promise<CollectedBacklink[]>`

开始收集外链数据。

**参数：**
- `maxCount` - 最大收集数量（10 或 20）

**返回：**
- `Promise<CollectedBacklink[]>` - 收集的外链数据数组

**示例：**
```typescript
const backlinks = await collectorRegistry.startCollection(10);
```

##### `stopCollection(): void`

停止当前的收集任务。

**示例：**
```typescript
collectorRegistry.stopCollection();
```

##### `getProgress(): { current: number; target: number } | null`

获取当前收集进度。

**返回：**
- `{ current: number; target: number }` - 当前进度和目标数量
- `null` - 没有正在进行的收集任务

**示例：**
```typescript
const progress = collectorRegistry.getProgress();
if (progress) {
  console.log(`进度: ${progress.current}/${progress.target}`);
}
```

##### `isCollecting(): boolean`

检查是否正在收集数据。

**返回：**
- `boolean` - 是否正在收集

**示例：**
```typescript
if (collectorRegistry.isCollecting()) {
  console.log('正在收集数据...');
}
```

##### `detectCollector(): Collector | null`

检测当前页面支持的收集器。

**返回：**
- `Collector` - 支持的收集器
- `null` - 不支持收集

**示例：**
```typescript
const collector = collectorRegistry.detectCollector();
if (collector) {
  console.log(`支持 ${collector.platform} 平台`);
}
```

### 检测函数

#### `isAhrefsBacklinkChecker(): boolean`

检测当前页面是否为 Ahrefs Backlink Checker。

**示例：**
```typescript
if (isAhrefsBacklinkChecker()) {
  console.log('当前页面是 Ahrefs Backlink Checker');
}
```

#### `getAhrefsTargetUrl(): string | null`

获取 Ahrefs 页面的目标 URL。

**示例：**
```typescript
const targetUrl = getAhrefsTargetUrl();
console.log('目标 URL:', targetUrl);
```

#### `getAhrefsMode(): string`

获取 Ahrefs 页面的模式（domain/subdomains/prefix/exact）。

**示例：**
```typescript
const mode = getAhrefsMode();
console.log('模式:', mode);
```

## 数据结构

### CollectedBacklink

收集的外链数据结构。

```typescript
interface CollectedBacklink {
  // 基本信息
  id: string;                      // 唯一标识
  source_platform: SourcePlatform; // 数据来源（ahrefs）
  collection_batch_id: string;     // 批次 ID
  collected_at: string;            // 收集时间（ISO 8601）

  // URL 信息
  target_domain: string;           // 目标域名
  target_url: string;              // 目标 URL
  referring_page_url: string;      // 引用页面 URL
  referring_domain: string;        // 引用域名

  // 内容信息
  anchor_text: string;             // 锚文本（最大 500 字符）
  page_title: string;              // 页面标题（最大 500 字符）

  // 指标数据
  raw_metrics: {
    domain_rating?: number;        // 域名评分（0-100）
    url_rating?: number;           // URL 评分（0-100）
    ahrefs_rank?: number;          // Ahrefs 排名
    linked_domains?: number;       // 链接域名数
    external_links?: number;       // 外部链接数
    first_seen?: string;           // 首次发现时间
    last_visited?: string;         // 最后访问时间
  };

  // 原始数据
  raw_snapshot: string;            // 原始快照（最大 5KB）

  // 状态信息
  status: BacklinkStatus;          // 状态
  created_at: string;              // 创建时间
  updated_at: string;              // 更新时间
}
```

## 工作流程

### 1. 页面检测

系统会自动检测当前页面是否为 Ahrefs Backlink Checker：

```
https://ahrefs.com/backlink-checker/?input=...&mode=...
```

### 2. API 拦截

拦截器会监听页面的网络请求，识别包含外链数据的 API 响应。

支持的请求类型：
- fetch API
- XMLHttpRequest

### 3. 数据解析

从 API 响应中提取外链数据，包括：
- URL 信息（目标 URL、引用 URL）
- 内容信息（锚文本、页面标题）
- 指标数据（域名评分、URL 评分等）

### 4. 数据标准化

- URL 规范化（移除尾部斜杠、默认端口）
- 文本清理（移除多余空白、换行符）
- 字段长度限制（锚文本和标题最大 500 字符）

### 5. 自动完成

达到目标数量后自动停止收集，返回结果。

## 错误处理

### 常见错误

#### 1. 当前页面不支持数据收集

```typescript
try {
  await collectorRegistry.startCollection(10);
} catch (error) {
  if (error.message.includes('不支持数据收集')) {
    console.log('请在 Ahrefs Backlink Checker 页面使用');
  }
}
```

#### 2. 收集超时

```typescript
try {
  await collectorRegistry.startCollection(10);
} catch (error) {
  if (error.message.includes('超时')) {
    console.log('收集超时，请刷新页面重试');
  }
}
```

#### 3. 数据解析失败

单条数据解析失败不会影响整批收集，系统会自动跳过无效数据。

## 最佳实践

### 1. 检查页面支持

在开始收集前，先检查当前页面是否支持：

```typescript
if (!isAhrefsBacklinkChecker()) {
  showNotification('请在 Ahrefs Backlink Checker 页面使用');
  return;
}
```

### 2. 显示收集进度

使用定时器显示收集进度：

```typescript
const timer = setInterval(() => {
  const progress = collectorRegistry.getProgress();
  if (progress) {
    updateProgressBar(progress.current, progress.target);
  } else {
    clearInterval(timer);
  }
}, 500);
```

### 3. 保存收集结果

将收集的数据保存到本地存储：

```typescript
async function saveBacklinks(backlinks: CollectedBacklink[]) {
  const key = `backlinks_${Date.now()}`;
  await chrome.storage.local.set({ [key]: backlinks });
}
```

### 4. 错误处理

始终使用 try-catch 处理错误：

```typescript
try {
  const backlinks = await collectorRegistry.startCollection(10);
  await saveBacklinks(backlinks);
  showSuccessNotification();
} catch (error) {
  console.error('收集失败:', error);
  showErrorNotification(error.message);
}
```

## 性能优化

### 1. 及时停止拦截

收集完成后，拦截器会自动停止。如需手动停止：

```typescript
collectorRegistry.stopCollection();
```

### 2. 限制收集数量

建议每次收集 10-20 条数据，避免过多数据影响性能。

### 3. 批量处理

如需收集大量数据，建议分批处理：

```typescript
async function collectInBatches(totalCount: number, batchSize: number = 10) {
  const results: CollectedBacklink[] = [];

  for (let i = 0; i < totalCount; i += batchSize) {
    const count = Math.min(batchSize, totalCount - i);
    const backlinks = await collectorRegistry.startCollection(count);
    results.push(...backlinks);

    // 等待一段时间再继续
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return results;
}
```

## 调试

### 启用调试日志

收集器会自动输出详细的日志信息到浏览器控制台：

```
[Ahrefs Detector] 检测到 Ahrefs 页面
[Ahrefs Interceptor] 开始拦截 API 请求
[Ahrefs Interceptor] 捕获 API 响应: https://api.ahrefs.com/...
[Ahrefs Parser] 成功解析 10/10 条外链
[Ahrefs Interceptor] 收集完成，共 10 条外链
```

### 查看收集的数据

在控制台查看收集的数据：

```typescript
const backlinks = await collectorRegistry.startCollection(10);
console.table(backlinks.map(b => ({
  引用URL: b.referring_page_url,
  锚文本: b.anchor_text,
  域名评分: b.raw_metrics.domain_rating,
})));
```

## 常见问题

### Q: 为什么收集不到数据？

A: 可能的原因：
1. 当前页面不是 Ahrefs Backlink Checker
2. 页面还没有加载完成
3. Ahrefs API 结构发生变化

### Q: 收集的数据不完整怎么办？

A: 系统会自动跳过无效数据，这是正常现象。如果大部分数据都不完整，可能是 API 结构变化，需要更新解析逻辑。

### Q: 可以同时收集多个页面的数据吗？

A: 不可以。每次只能在一个页面收集数据。如需收集多个页面，请依次访问并收集。

### Q: 收集的数据保存在哪里？

A: 收集器只负责提取数据，不会自动保存。你需要自己实现保存逻辑（如保存到 chrome.storage 或发送到后端）。

## 技术支持

如有问题或建议，请查看：
- [README.md](./README.md) - 技术文档
- [ahrefs-collector.test.ts](./ahrefs-collector.test.ts) - 测试用例
