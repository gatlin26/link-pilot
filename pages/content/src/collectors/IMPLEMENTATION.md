# Ahrefs 数据收集功能实现总结

## 已完成的文件

### 1. 核心功能文件

#### `/packages/shared/lib/utils/dom-helpers.ts`
DOM 辅助工具，提供：
- `normalizeUrl()` - URL 规范化
- `cleanText()` - 文本清理
- `truncateString()` - 字符串截断
- `extractDomain()` - 域名提取
- `isValidUrl()` - URL 验证
- `safeJsonParse()` - 安全 JSON 解析

#### `/pages/content/src/collectors/ahrefs-detector.ts`
Ahrefs 页面检测器，提供：
- `isAhrefsBacklinkChecker()` - 检测是否为 Ahrefs 页面
- `getAhrefsTargetUrl()` - 获取目标 URL
- `getAhrefsMode()` - 获取查询模式

#### `/pages/content/src/collectors/ahrefs-api-interceptor.ts`
API 拦截器，实现：
- 拦截 fetch 和 XMLHttpRequest 请求
- 识别 Ahrefs API 响应
- 自动收集指定数量的数据
- 超时保护（60秒）
- 完成后自动停止

#### `/pages/content/src/collectors/ahrefs-parser.ts`
数据解析器，实现：
- 解析 API 响应数据
- 提取外链字段（URL、锚文本、标题、指标）
- 数据标准化和验证
- 容错机制（单条失败不影响整批）
- 字段长度限制

#### `/pages/content/src/collectors/collector-registry.ts`
收集器注册表，提供：
- 统一的收集接口
- 多平台支持（可扩展）
- 进度跟踪
- 状态管理

#### `/pages/content/src/collectors/index.ts`
模块导出文件

### 2. 示例和文档

#### `/pages/content/src/collector-example.ts`
使用示例，展示：
- 初始化收集器
- 开始收集数据
- 停止收集
- 获取进度
- 检查状态

#### `/pages/content/src/collectors/README.md`
技术文档（英文），包含：
- 架构设计
- 使用方法
- 数据结构
- 工作原理
- 容错机制
- 扩展支持

#### `/pages/content/src/collectors/USAGE.md`
使用指南（中文），包含：
- 快速开始
- 完整示例
- API 参考
- 数据结构
- 工作流程
- 错误处理
- 最佳实践
- 常见问题

### 3. 测试文件

#### `/pages/content/src/collectors/ahrefs-collector.test.ts`
单元测试，覆盖：
- 页面检测
- DOM 辅助工具
- 数据解析
- 容错处理

## 核心功能特性

### 1. API 拦截
- ✅ 拦截 fetch 请求
- ✅ 拦截 XMLHttpRequest 请求
- ✅ 识别 Ahrefs API 响应
- ✅ 自动提取外链数据

### 2. 数据解析
- ✅ 支持多种 API 响应结构
- ✅ 提取必需字段（URL、锚文本、标题）
- ✅ 提取指标字段（域名评分、URL 评分等）
- ✅ 生成唯一 ID
- ✅ 生成批次 ID

### 3. 数据标准化
- ✅ URL 规范化（移除尾部斜杠、默认端口）
- ✅ 文本清理（移除多余空白、换行符）
- ✅ 字段长度限制（锚文本和标题最大 500 字符，快照最大 5KB）
- ✅ 域名提取
- ✅ URL 验证

### 4. 容错机制
- ✅ 单条解析失败不影响整批
- ✅ 字段验证（URL 格式、必需字段）
- ✅ 超时保护（60秒）
- ✅ 错误日志记录
- ✅ 安全停止机制

### 5. 收集控制
- ✅ 支持收集 10 条或 20 条数据
- ✅ 达到目标数量自动停止
- ✅ 手动停止收集
- ✅ 进度跟踪
- ✅ 状态管理

### 6. 扩展性
- ✅ 收集器接口设计
- ✅ 注册表模式
- ✅ 易于添加新平台支持

## 使用方法

### 基本用法

```typescript
import { collectorRegistry } from '@src/collectors';

// 收集 10 条外链
const backlinks = await collectorRegistry.startCollection(10);

// 收集 20 条外链
const backlinks = await collectorRegistry.startCollection(20);
```

### 完整示例

```typescript
import { collectorRegistry, isAhrefsBacklinkChecker } from '@src/collectors';

// 检测页面
if (isAhrefsBacklinkChecker()) {
  try {
    // 开始收集
    const backlinks = await collectorRegistry.startCollection(10);

    // 处理数据
    console.log(`收集成功: ${backlinks.length} 条外链`);

    // 保存数据
    await saveToStorage(backlinks);
  } catch (error) {
    console.error('收集失败:', error);
  }
}
```

## 数据结构

### CollectedBacklink

```typescript
{
  id: string;                      // 唯一标识
  source_platform: 'ahrefs';       // 数据来源
  collection_batch_id: string;     // 批次 ID
  collected_at: string;            // 收集时间
  target_domain: string;           // 目标域名
  target_url: string;              // 目标 URL
  referring_page_url: string;      // 引用页面 URL
  referring_domain: string;        // 引用域名
  anchor_text: string;             // 锚文本（最大 500 字符）
  page_title: string;              // 页面标题（最大 500 字符）
  raw_metrics: {                   // 原始指标
    domain_rating?: number;        // 域名评分
    url_rating?: number;           // URL 评分
    ahrefs_rank?: number;          // Ahrefs 排名
    linked_domains?: number;       // 链接域名数
    external_links?: number;       // 外部链接数
    first_seen?: string;           // 首次发现时间
    last_visited?: string;         // 最后访问时间
  };
  raw_snapshot: string;            // 原始快照（最大 5KB）
  status: 'collected';             // 状态
  created_at: string;              // 创建时间
  updated_at: string;              // 更新时间
}
```

## 工作流程

1. **页面检测** - 检测是否为 Ahrefs Backlink Checker 页面
2. **启动拦截** - 开始拦截网络请求
3. **捕获响应** - 识别包含外链数据的 API 响应
4. **解析数据** - 从响应中提取外链信息
5. **标准化** - 规范化 URL、清理文本、限制长度
6. **收集完成** - 达到目标数量后自动停止
7. **返回结果** - 返回收集的外链数据

## 技术亮点

1. **非侵入式** - 不修改页面 DOM，只监听网络请求
2. **高性能** - 使用原生 API 拦截，性能开销小
3. **容错性强** - 单条失败不影响整批，自动跳过无效数据
4. **易于扩展** - 收集器接口设计，易于添加新平台
5. **类型安全** - 完整的 TypeScript 类型定义
6. **测试覆盖** - 包含单元测试

## 注意事项

1. **浏览器兼容性** - 需要支持 ES6+ 和 fetch API
2. **API 变化** - Ahrefs 可能更新 API 结构，需定期测试
3. **性能影响** - 拦截器会影响所有网络请求，建议收集完成后立即停止
4. **数据隐私** - 仅在客户端处理，不发送到第三方

## 下一步

1. 集成到 Chrome 扩展的 content script
2. 实现数据保存到本地存储
3. 添加 UI 界面（收集按钮、进度条）
4. 实现数据同步到后端
5. 添加更多平台支持（Semrush、Moz 等）

## 测试方法

访问测试页面：
```
https://ahrefs.com/backlink-checker/?input=https%3A%2F%2Fahrefs.com%2F&mode=subdomains
```

在浏览器控制台执行：
```javascript
// 导入收集器
import { collectorRegistry } from '@src/collectors';

// 开始收集
const backlinks = await collectorRegistry.startCollection(10);

// 查看结果
console.table(backlinks);
```
