# 浏览器卡死问题诊断报告

## 🔴 严重问题

### 1. **事件监听器泄漏**

**位置**: `collection-manager.ts:611-628`

**问题代码**:
```typescript
private waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);  // ⚠️ 问题
      reject(new Error('页面加载超时'));
    }, 30000);

    const listener = (id: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);  // ⚠️ 每次调用都添加新监听器
  });
}
```

**问题**:
1. 每次调用 `waitForTabLoad` 都会添加一个新的 `chrome.tabs.onUpdated` 监听器
2. 如果页面加载超时，监听器会被移除
3. 但如果多次调用（重试、并发），会累积大量监听器
4. **这些监听器会在每次标签页更新时被触发，导致性能问题**

**影响**:
- 🔴 内存泄漏
- 🔴 CPU 占用过高
- 🔴 浏览器卡死

### 2. **无限重试循环**

**位置**: `collection-manager.ts:660-698`

**问题代码**:
```typescript
private async sendMessageToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
  const maxAttempts = 5;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, message)) as T;
      return response;
    } catch (error) {
      lastError = error;
      if (!this.isReceivingEndMissingError(error)) {
        throw error;
      }

      // ⚠️ 每次重试都重新注入 content script
      await this.ensureContentScript(tabId);
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
    }
  }
  // ...
}
```

**问题**:
1. 每次重试都调用 `ensureContentScript`，重新注入脚本
2. 如果标签页已经关闭或无效，会一直失败
3. 重复注入可能导致脚本冲突
4. 5 次重试 × 多个并发请求 = 大量无效操作

**影响**:
- 🔴 CPU 占用过高
- 🔴 内存占用增加
- 🔴 浏览器响应缓慢

### 3. **页面加载超时处理不当**

**位置**: `collection-manager.ts:613-616`

**问题**:
```typescript
const timeout = setTimeout(() => {
  chrome.tabs.onUpdated.removeListener(listener);
  reject(new Error('页面加载超时'));  // ⚠️ 只是 reject，没有清理资源
}, 30000);
```

**问题**:
1. 超时后只是 reject Promise，但标签页可能还在加载
2. 没有停止标签页加载（`chrome.tabs.stop`）
3. 没有关闭标签页
4. 资源继续占用

**影响**:
- 🔴 内存泄漏
- 🔴 标签页累积
- 🔴 浏览器卡死

## 🔍 根本原因

### 主要原因

1. **事件监听器累积**
   - 每次采集都添加新的 `chrome.tabs.onUpdated` 监听器
   - 监听器没有正确清理
   - 导致内存泄漏和性能下降

2. **标签页资源泄漏**
   - 超时的标签页没有被关闭
   - 继续占用内存和 CPU
   - 累积多个标签页后浏览器卡死

3. **重复注入脚本**
   - 每次重试都重新注入 content script
   - 可能导致脚本冲突和内存泄漏

## 🛠️ 修复方案

### 修复 1: 改进 waitForTabLoad

```typescript
private waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let isResolved = false;

    const cleanup = () => {
      if (!isResolved) {
        isResolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
      }
    };

    const timeout = setTimeout(async () => {
      cleanup();

      // 停止页面加载
      try {
        await chrome.tabs.update(tabId, { url: 'about:blank' });
      } catch (e) {
        // 标签页可能已关闭
      }

      reject(new Error('页面加载超时'));
    }, 30000);

    const listener = (id: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') {
        cleanup();
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // 检查标签页是否已经加载完成
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        cleanup();
        resolve();
      }
    }).catch(() => {
      cleanup();
      reject(new Error('标签页不存在'));
    });
  });
}
```

### 修复 2: 改进 sendMessageToTab

```typescript
private async sendMessageToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
  const maxAttempts = 3;  // 减少重试次数
  let lastError: unknown = null;
  let scriptInjected = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // 先检查标签页是否存在
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        throw new Error('标签页不存在');
      }

      const response = (await chrome.tabs.sendMessage(tabId, message)) as T;
      return response;
    } catch (error) {
      lastError = error;

      if (!this.isReceivingEndMissingError(error)) {
        throw error;
      }

      // 只注入一次
      if (!scriptInjected) {
        await this.ensureContentScript(tabId);
        scriptInjected = true;
      }

      // 指数退避
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError;
}
```

### 修复 3: 添加资源清理

```typescript
private async cleanupTab(tabId: number): Promise<void> {
  try {
    // 停止页面加载
    await chrome.tabs.update(tabId, { url: 'about:blank' });

    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 100));

    // 关闭标签页
    await chrome.tabs.remove(tabId);

    // 解绑 WebRequest
    unbindCollectionTab(tabId);
  } catch (error) {
    // 标签页可能已经关闭
    console.warn('清理标签页失败:', error);
  }
}
```

### 修复 4: 添加全局监听器管理

```typescript
class TabLoadWaiter {
  private listeners = new Map<number, (id: number, info: chrome.tabs.TabChangeInfo) => void>();
  private globalListener: ((id: number, info: chrome.tabs.TabChangeInfo) => void) | null = null;

  constructor() {
    this.globalListener = (id, info) => {
      const listener = this.listeners.get(id);
      if (listener) {
        listener(id, info);
      }
    };
    chrome.tabs.onUpdated.addListener(this.globalListener);
  }

  wait(tabId: number, timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.listeners.delete(tabId);
        reject(new Error('页面加载超时'));
      }, timeout);

      const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
        if (info.status === 'complete') {
          clearTimeout(timeoutId);
          this.listeners.delete(tabId);
          resolve();
        }
      };

      this.listeners.set(tabId, listener);
    });
  }

  cleanup() {
    if (this.globalListener) {
      chrome.tabs.onUpdated.removeListener(this.globalListener);
      this.globalListener = null;
    }
    this.listeners.clear();
  }
}
```

## 🚨 紧急修复步骤

### 立即执行

1. **重启浏览器**
   - 关闭所有 Chrome 窗口
   - 重新打开

2. **禁用扩展**
   - 打开 `chrome://extensions/`
   - 暂时禁用 Link Pilot
   - 清理后台进程

3. **清理扩展数据**
   ```javascript
   // 在扩展的 Background Service Worker Console 中执行
   chrome.storage.local.clear();
   chrome.storage.session.clear();
   ```

4. **重新加载扩展**
   - 应用修复后的代码
   - 重新编译
   - 重新加载扩展

## 📊 监控指标

添加性能监控：

```typescript
// 监控事件监听器数量
console.log('chrome.tabs.onUpdated listeners:',
  chrome.tabs.onUpdated['listeners_']?.length || 0);

// 监控标签页数量
chrome.tabs.query({}, tabs => {
  console.log('Total tabs:', tabs.length);
  console.log('Ahrefs tabs:', tabs.filter(t => t.url?.includes('ahrefs.com')).length);
});

// 监控内存使用
if (performance.memory) {
  console.log('Memory:', {
    used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
    total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
    limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB',
  });
}
```

## ✅ 验证修复

修复后验证：

1. **检查监听器数量**
   - 应该保持稳定，不增长

2. **检查标签页数量**
   - 超时的标签页应该被关闭

3. **检查内存使用**
   - 不应该持续增长

4. **测试采集功能**
   - 多次采集不应该导致卡顿

## 🎯 预防措施

1. **限制并发采集**
   - 同时最多 1-2 个采集任务

2. **添加超时保护**
   - 所有异步操作都应该有超时

3. **及时清理资源**
   - 标签页、监听器、定时器

4. **添加错误恢复**
   - 检测到异常时自动清理

## 📝 总结

**根本原因**: 事件监听器泄漏 + 标签页资源泄漏

**修复优先级**:
1. 🔴 高：修复 waitForTabLoad 的监听器泄漏
2. 🔴 高：添加标签页清理逻辑
3. 🟡 中：优化 sendMessageToTab 重试逻辑
4. 🟢 低：添加性能监控

**预期效果**:
- ✅ 浏览器不再卡死
- ✅ 内存使用稳定
- ✅ 采集功能正常
