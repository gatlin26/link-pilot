# Google Sheets 同步功能

## 概述

Link Pilot 插件通过 Google Apps Script (GAS) Web App 实现与 Google Sheets 的数据同步。

## 文件结构

```
packages/shared/lib/services/
├── sheets-api-client.ts    # Google Sheets API 客户端
├── sync-service.ts          # 同步服务
└── index.ts                 # 导出

docs/
├── gas-setup-guide.md       # GAS 部署指南
└── sync-usage-examples.md   # 使用示例
```

## 核心组件

### 1. SheetsApiClient

负责与 GAS Web App 通信的 HTTP 客户端。

**功能：**
- 发送 POST 请求到 GAS Web App
- 支持超时控制
- 批量同步 4 种实体类型（backlinks, opportunities, templates, submissions）
- 测试连接

### 2. SyncService

负责协调同步流程的服务层。

**功能：**
- 从同步队列获取待处理任务
- 按实体类型分组
- 分批发送数据（默认 50 条/批）
- 处理同步结果
- 错误处理和重试

### 3. Google Apps Script

部署在 Google 服务器上的 Web App，负责接收数据并写入 Google Sheets。

**功能：**
- 提供 RESTful API 接口
- 自动创建和管理 4 张 Sheet
- 批量写入数据
- 支持新增和更新操作
- 返回详细的执行结果

## 数据流

```
插件本地存储
    ↓
同步队列 (SyncQueueService)
    ↓
同步服务 (SyncService)
    ↓
API 客户端 (SheetsApiClient)
    ↓ HTTP POST
GAS Web App
    ↓
Google Sheets
```

## 使用流程

### 1. 部署 GAS Web App

参考 [gas-setup-guide.md](./gas-setup-guide.md) 完成部署。

### 2. 配置插件

在插件 Options 页面配置 Web App URL。

### 3. 自动同步

插件会自动：
- 将新增/更新的数据加入同步队列
- 每 5 分钟执行一次同步
- 失败任务自动重试（最多 3 次）
- 清理 7 天前的已完成任务

### 4. 手动同步

用户可以在 Options 页面点击"立即同步"按钮手动触发同步。

## 同步策略

- **批量大小**：50 条/批
- **同步频率**：5 分钟
- **最大重试**：3 次
- **重试延迟**：5 秒
- **超时时间**：30 秒

## 支持的实体类型

1. **CollectedBacklink** - 已收集外链
2. **Opportunity** - 机会
3. **SiteTemplate** - 站点模板
4. **Submission** - 提交记录

## API 接口

### POST /api/backlinks
同步已收集外链

### POST /api/opportunities
同步机会

### POST /api/templates
同步站点模板

### POST /api/submissions
同步提交记录

### POST /api/ping
测试连接

## 错误处理

- **网络错误**：自动重试
- **超时错误**：记录失败，等待下次重试
- **数据格式错误**：记录错误信息，跳过该条数据
- **GAS 执行错误**：返回详细错误信息

## 安全性

- Web App URL 包含访问令牌，需妥善保管
- 建议使用 Google Workspace 账号以获得更好的安全控制
- 定期备份 Google Sheets 数据

## 性能优化

- 批量发送减少 HTTP 请求次数
- 分批处理避免 GAS 执行超时
- 异步处理不阻塞主线程
- 定期清理已完成任务

## 监控和调试

### 查看同步统计

```typescript
const stats = await syncQueueService.getStats();
console.log(stats);
```

### 查看失败任务

```typescript
const failed = await syncQueueService.getFailedJobs();
console.log(failed);
```

### 重试失败任务

```typescript
await syncQueueService.retryFailed();
```

## 更多信息

- [GAS 部署指南](./gas-setup-guide.md)
- [使用示例](./sync-usage-examples.md)
