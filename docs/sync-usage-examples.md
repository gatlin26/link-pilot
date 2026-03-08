# Google Sheets 同步功能使用示例

## 概述

本文档展示如何在插件中使用 Google Sheets 同步功能。

## 架构说明

```
插件端                          Google Apps Script
┌─────────────────┐            ┌──────────────────┐
│  SyncService    │  ──HTTP──> │   Web App API    │
│                 │            │                  │
│  - 批量获取任务  │            │  - 接收数据       │
│  - 分批发送数据  │            │  - 写入 Sheets   │
│  - 更新同步状态  │            │  - 返回结果       │
└─────────────────┘            └──────────────────┘
        ↑                               ↓
        │                      ┌──────────────────┐
┌─────────────────┐            │  Google Sheets   │
│ SyncQueueService│            │                  │
│                 │            │  - backlinks     │
│  - 管理同步队列  │            │  - opportunities │
│  - 重试失败任务  │            │  - templates     │
└─────────────────┘            │  - submissions   │
                               └──────────────────┘
```

## 基础用法

### 1. 配置同步服务

```typescript
import { SyncService } from '@extension/shared/lib/services';

// 从配置中获取 Web App URL
const webAppUrl = await getWebAppUrlFromConfig();

// 创建同步服务实例
const syncService = new SyncService({
  webAppUrl,
  batchSize: 50, // 可选，默认 50
});

// 测试连接
const isConnected = await syncService.testConnection();
if (!isConnected) {
  console.error('无法连接到 Google Sheets');
}
```

### 2. 实现数据获取器

```typescript
import { backlinkStorage } from '@extension/storage/lib/impl/backlink-storage';
import { opportunityStorage } from '@extension/storage/lib/impl/opportunity-storage';
import { templateStorage } from '@extension/storage/lib/impl/template-storage';
import { submissionStorage } from '@extension/storage/lib/impl/submission-storage';
import type { DataFetcher } from '@extension/shared/lib/services';

const dataFetcher: DataFetcher = {
  getBacklinkById: async (id: string) => {
    return backlinkStorage.getById(id);
  },
  getOpportunityById: async (id: string) => {
    return opportunityStorage.getById(id);
  },
  getTemplateById: async (id: string) => {
    return templateStorage.getById(id);
  },
  getSubmissionById: async (id: string) => {
    return submissionStorage.getById(id);
  },
};
```

### 3. 执行同步

```typescript
import { syncQueueService } from '@extension/storage/lib/services/sync-queue-service';

// 获取待同步的任务（最多 100 个）
const pendingJobs = await syncQueueService.getPendingJobs(100);

if (pendingJobs.length === 0) {
  console.log('没有待同步的任务');
  return;
}

// 执行同步
const result = await syncService.syncJobs(pendingJobs, dataFetcher);

console.log(`同步完成: 总计 ${result.total}, 成功 ${result.synced}, 失败 ${result.failed}`);

// 更新任务状态
for (const job of pendingJobs) {
  const error = result.errors?.find(e => e.jobId === job.id);

  if (error) {
    await syncQueueService.markFailed(job.id, error.error);
  } else {
    await syncQueueService.markSuccess(job.id);
  }
}
```

## 完整示例：后台同步服务

### Background Service Worker

```typescript
// packages/chrome-extension/src/background/index.ts

import { SyncService, type DataFetcher } from '@extension/shared/lib/services';
import { syncQueueService } from '@extension/storage/lib/services/sync-queue-service';
import { backlinkStorage } from '@extension/storage/lib/impl/backlink-storage';
import { opportunityStorage } from '@extension/storage/lib/impl/opportunity-storage';
import { templateStorage } from '@extension/storage/lib/impl/template-storage';
import { submissionStorage } from '@extension/storage/lib/impl/submission-storage';

// 同步间隔（5 分钟）
const SYNC_INTERVAL = 5 * 60 * 1000;

// 数据获取器
const dataFetcher: DataFetcher = {
  getBacklinkById: (id) => backlinkStorage.getById(id),
  getOpportunityById: (id) => opportunityStorage.getById(id),
  getTemplateById: (id) => templateStorage.getById(id),
  getSubmissionById: (id) => submissionStorage.getById(id),
};

// 同步函数
async function performSync() {
  try {
    // 获取配置
    const config = await chrome.storage.sync.get(['webAppUrl']);
    if (!config.webAppUrl) {
      console.log('未配置 Web App URL，跳过同步');
      return;
    }

    // 创建同步服务
    const syncService = new SyncService({
      webAppUrl: config.webAppUrl,
    });

    // 获取待同步任务
    const pendingJobs = await syncQueueService.getPendingJobs(100);
    if (pendingJobs.length === 0) {
      console.log('没有待同步的任务');
      return;
    }

    console.log(`开始同步 ${pendingJobs.length} 个任务`);

    // 执行同步
    const result = await syncService.syncJobs(pendingJobs, dataFetcher);

    // 更新任务状态
    for (const job of pendingJobs) {
      const error = result.errors?.find(e => e.jobId === job.id);

      if (error) {
        await syncQueueService.markFailed(job.id, error.error);
      } else {
        await syncQueueService.markSuccess(job.id);
      }
    }

    console.log(
      `同步完成: 总计 ${result.total}, 成功 ${result.synced}, 失败 ${result.failed}`
    );

    // 如果有失败的任务，记录错误
    if (result.errors && result.errors.length > 0) {
      console.error('同步错误:', result.errors);
    }
  } catch (error) {
    console.error('同步失败:', error);
  }
}

// 定时同步
setInterval(performSync, SYNC_INTERVAL);

// 立即执行一次
performSync();

// 监听手动同步请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MANUAL_SYNC') {
    performSync().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放
  }
});
```

## 添加数据到同步队列

### 收集外链时自动入队

```typescript
import { syncQueueService } from '@extension/storage/lib/services/sync-queue-service';
import { SyncEntityType, SyncOperation } from '@extension/shared/lib/types/enums';

// 保存外链后，添加到同步队列
async function saveBacklink(backlink: CollectedBacklink) {
  // 保存到本地存储
  await backlinkStorage.add(backlink);

  // 添加到同步队列
  await syncQueueService.enqueue(
    SyncEntityType.BACKLINK,
    backlink.id,
    SyncOperation.CREATE
  );

  console.log(`外链 ${backlink.id} 已添加到同步队列`);
}
```

### 批量入队

```typescript
// 批量收集外链后，批量入队
async function saveBacklinkBatch(backlinks: CollectedBacklink[]) {
  // 保存到本地存储
  await backlinkStorage.addBatch(backlinks);

  // 批量添加到同步队列
  const jobs = backlinks.map(backlink => ({
    entityType: SyncEntityType.BACKLINK,
    entityId: backlink.id,
    operation: SyncOperation.CREATE,
  }));

  await syncQueueService.enqueueBatch(jobs);

  console.log(`${backlinks.length} 个外链已添加到同步队列`);
}
```

### 更新数据时入队

```typescript
// 更新外链状态后，添加到同步队列
async function updateBacklinkStatus(id: string, status: BacklinkStatus) {
  // 更新本地存储
  await backlinkStorage.update(id, { status });

  // 添加到同步队列（更新操作）
  await syncQueueService.enqueue(
    SyncEntityType.BACKLINK,
    id,
    SyncOperation.UPDATE
  );

  console.log(`外链 ${id} 状态更新已添加到同步队列`);
}
```

## Options 页面配置

### 配置界面

```typescript
// packages/chrome-extension/src/options/Options.tsx

import { useState } from 'react';
import { SyncService } from '@extension/shared/lib/services';

export default function Options() {
  const [webAppUrl, setWebAppUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // 加载配置
  useEffect(() => {
    chrome.storage.sync.get(['webAppUrl'], (result) => {
      if (result.webAppUrl) {
        setWebAppUrl(result.webAppUrl);
      }
    });
  }, []);

  // 测试连接
  const handleTestConnection = async () => {
    if (!webAppUrl) {
      alert('请先输入 Web App URL');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const syncService = new SyncService({ webAppUrl });
      const isConnected = await syncService.testConnection();

      setTestResult(isConnected ? 'success' : 'error');
    } catch (error) {
      console.error('测试连接失败:', error);
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    await chrome.storage.sync.set({ webAppUrl });
    alert('配置已保存');
  };

  // 手动触发同步
  const handleManualSync = async () => {
    chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' }, (response) => {
      if (response.success) {
        alert('同步已完成');
      } else {
        alert(`同步失败: ${response.error}`);
      }
    });
  };

  return (
    <div>
      <h2>Google Sheets 同步配置</h2>

      <div>
        <label>Web App URL:</label>
        <input
          type="text"
          value={webAppUrl}
          onChange={(e) => setWebAppUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/.../exec"
          style={{ width: '500px' }}
        />
      </div>

      <div>
        <button onClick={handleTestConnection} disabled={testing}>
          {testing ? '测试中...' : '测试连接'}
        </button>
        {testResult === 'success' && <span style={{ color: 'green' }}>✓ 连接成功</span>}
        {testResult === 'error' && <span style={{ color: 'red' }}>✗ 连接失败</span>}
      </div>

      <div>
        <button onClick={handleSave}>保存配置</button>
        <button onClick={handleManualSync}>立即同步</button>
      </div>

      <div>
        <a href="/docs/gas-setup-guide.md" target="_blank">
          查看部署指南
        </a>
      </div>
    </div>
  );
}
```

## 监控同步状态

### 查看同步统计

```typescript
import { syncQueueService } from '@extension/storage/lib/services/sync-queue-service';

// 获取同步统计
const stats = await syncQueueService.getStats();

console.log(`
  总任务数: ${stats.total}
  待处理: ${stats.pending}
  已成功: ${stats.success}
  已失败: ${stats.failed}
`);
```

### 重试失败任务

```typescript
// 重试所有失败的任务
await syncQueueService.retryFailed();
console.log('已将所有失败任务重新加入队列');
```

### 清理已完成任务

```typescript
// 清理 7 天前的已完成任务
const cleaned = await syncQueueService.cleanupCompleted(7);
console.log(`已清理 ${cleaned} 个已完成任务`);
```

## 错误处理

### 常见错误及处理

```typescript
try {
  const result = await syncService.syncJobs(pendingJobs, dataFetcher);

  if (!result.success) {
    // 同步失败
    console.error('同步失败:', result.errors);

    // 通知用户
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: '同步失败',
      message: `${result.failed} 个任务同步失败，请检查配置`,
    });
  }
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('超时')) {
      console.error('同步超时，请检查网络连接');
    } else if (error.message.includes('HTTP error')) {
      console.error('服务器错误，请检查 Web App 部署');
    } else {
      console.error('未知错误:', error.message);
    }
  }
}
```

## 性能优化建议

1. **批量大小**：默认 50 条/批，可根据数据大小调整
2. **同步频率**：建议 5-10 分钟一次，避免频繁请求
3. **错误重试**：最多重试 3 次，避免无限重试
4. **清理策略**：定期清理已完成任务，避免队列过大

## 安全注意事项

1. **URL 保护**：Web App URL 包含访问令牌，不要泄露
2. **数据验证**：同步前验证数据格式，避免写入无效数据
3. **权限控制**：确保 GAS 脚本只有你自己可以编辑
4. **备份数据**：定期导出 Google Sheets 数据作为备份
