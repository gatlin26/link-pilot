# Ahrefs 数据收集器

## 概述

本模块实现了 Ahrefs Backlink Checker 页面的 API 监听和数据收集功能。通过拦截网络请求，自动提取外链数据。

## 架构设计

### 核心组件

1. **ahrefs-detector.ts** - 页面检测器
   - 检测是否为 Ahrefs 页面
   - 提取目标 URL 和模式参数

2. **ahrefs-api-interceptor.ts** - API 拦截器
   - 拦截 fetch 和 XMLHttpRequest 请求
   - 识别 Ahrefs API 响应
   - 自动收集指定数量的数据

3. **ahrefs-parser.ts** - 数据解析器
   - 解析 API 响应数据
   - 提取外链字段
   - 数据标准化和验证

4. **collector-registry.ts** - 收集器注册表
   - 管理多平台收集器
   - 统一的收集接口
   - 进度跟踪

5. **dom-helpers.ts** - DOM 辅助工具
   - URL 规范化
   - 文本清理
   - 字段验证

## 使用方法

### 基本用法

```typescript
import { collectorRegistry } from './collectors';

// 开始收集 10 条外链
const backlinks = await collectorRegistry.startCollection(10);

// 开始收集 20 条外链
const backlinks = await collectorRegistry.startCollection(20);
```

### 完整示例

```typescript
import {
  collectorRegistry,
  isAhrefsBacklinkChecker
} from './collectors';

// 1. 检测当前页面
if (isAhrefsBacklinkChecker()) {
  console.log('当前页面支持数据收集');

  // 2. 开始收集
  try {
    const backlinks = await collectorRegistry.startCollection(10);
    console.log(`收集成功: ${backlinks.length} 条外链`);

    // 3. 处理数据
    backlinks.forEach(backlink => {
      console.log({
        target: backlink.target_url,
        referring: backlink.referring_page_url,
        anchor: backlink.anchor_text,
        title: backlink.page_title,
      });
    });
  } catch (error) {
    console.error('收集失败:', error);
  }
}
```

### 进度监控

```typescript
// 检查是否正在收集
if (collectorRegistry.isCollecting()) {
  // 获取进度
  const progress = collectorRegistry.getProgress();
  console.log(`进度: ${progress.current}/${progress.target}`);
}

// 停止收集
collectorRegistry.stopCollection();
```

## 数据结构

### CollectedBacklink

```typescript
interface CollectedBacklink {
  id: string;                      // 唯一标识
  source_platform: SourcePlatform; // 数据来源（ahrefs）
  collection_batch_id: string;     // 批次 ID
  collected_at: string;            // 收集时间
  target_domain: string;           // 目标域名
  target_url: string;              // 目标 URL
  referring_page_url: string;      // 引用页面 URL
  referring_domain: string;        // 引用域名
  anchor_text: string;             // 锚文本（最大 500 字符）
  page_title: string;              // 页面标题（最大 500 字符）
  raw_metrics: Record<string, unknown>; // 原始指标
  raw_snapshot: string;            // 原始快照（最大 5KB）
  status: BacklinkStatus;          // 状态
  created_at: string;              // 创建时间
  updated_at: string;              // 更新时间
}
```

### 原始指标字段

```typescript
raw_metrics: {
  domain_rating?: number;    // 域名评分
  url_rating?: number;       // URL 评分
  ahrefs_rank?: number;      // Ahrefs 排名
  linked_domains?: number;   // 链接域名数
  external_links?: number;   // 外部链接数
  first_seen?: string;       // 首次发现时间
  last_visited?: string;     // 最后访问时间
}
```

## 工作原理

### 1. 页面检测

检测当前页面是否为 Ahrefs Backlink Checker：
- 检查域名是否包含 `ahrefs.com`
- 检查路径是否包含 `/backlink-checker`

### 2. API 拦截

拦截两种类型的网络请求：
- **fetch API** - 现代浏览器的标准请求方式
- **XMLHttpRequest** - 传统的 AJAX 请求方式

识别 Ahrefs API 请求的特征：
- URL 包含 `api.ahrefs.com`
- URL 包含 `backlink`、`refpages` 等关键词

### 3. 数据解析

从 API 响应中提取外链数据：
- 支持多种数据结构（`backlinks`、`data`、`results`、`items` 等）
- 提取必需字段：`url_from`、`url_to`、`anchor`、`title`
- 提取指标字段：`domain_rating`、`url_rating` 等

### 4. 数据标准化

- **URL 规范化**：移除尾部斜杠、默认端口
- **文本清理**：移除多余空白、换行符
- **字段限制**：锚文本和标题最大 500 字符，快照最大 5KB
- **容错处理**：单条解析失败不影响整批

### 5. 自动完成

- 达到目标数量自动停止
- 超时保护（60秒）
- 回调通知

## 容错机制

1. **单条失败不影响整批**
   - 每条外链独立解析
   - 解析失败记录日志并继续

2. **字段验证**
   - URL 格式验证
   - 必需字段检查
   - 无效数据跳过

3. **超时保护**
   - 60秒超时限制
   - 超时返回已收集的数据

4. **状态管理**
   - 防止重复启动
   - 安全停止机制
   - 资源清理

## 注意事项

1. **浏览器兼容性**
   - 需要支持 ES6+ 语法
   - 需要支持 fetch API 和 Proxy

2. **性能考虑**
   - 拦截器会影响所有网络请求
   - 建议收集完成后立即停止

3. **数据隐私**
   - 仅在客户端处理数据
   - 不会发送到第三方服务器

4. **API 变化**
   - Ahrefs 可能更新 API 结构
   - 需要定期测试和更新解析逻辑

## 扩展支持

### 添加新平台

1. 创建检测器
```typescript
export function isNewPlatform(): boolean {
  // 检测逻辑
}
```

2. 创建收集器
```typescript
class NewPlatformCollector implements Collector {
  platform = SourcePlatform.NEW_PLATFORM;
  detect() { return isNewPlatform(); }
  async start(maxCount: number) { /* 实现 */ }
  stop() { /* 实现 */ }
  getProgress() { /* 实现 */ }
}
```

3. 注册收集器
```typescript
collectorRegistry.register(new NewPlatformCollector());
```

## 测试

访问测试页面：
```
https://ahrefs.com/backlink-checker/?input=https%3A%2F%2Fahrefs.com%2F&mode=subdomains
```

打开浏览器控制台，执行：
```javascript
// 开始收集
await collectorRegistry.startCollection(10);
```

查看收集的数据和日志输出。
