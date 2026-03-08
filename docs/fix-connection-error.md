# 修复说明

## 问题描述
浮动采集器在初始化时出现 "Could not establish connection. Receiving end does not exist" 错误。

## 根本原因
1. 多个文件注册了 `chrome.runtime.onMessage` 监听器，可能导致消息处理冲突
2. Content script 在 background script 完全准备好之前就尝试发送消息
3. 缺少健康检查机制来确保 background script 已就绪

## 解决方案

### 1. 创建统一的消息路由器
- 文件：`chrome-extension/src/background/message-router.ts`
- 功能：统一管理所有消息处理器，避免冲突
- 内置 PING 处理器用于健康检查

### 2. 重构消息处理
- 所有 background script 模块使用 `messageRouter.register()` 注册处理器
- 修改的文件：
  - `collection-manager.ts`
  - `context-manager.ts`
  - `sync-manager.ts`

### 3. 添加健康检查机制
- 浮动采集器在初始化前先检查 background script 是否准备好
- 使用 PING 消息测试连接
- 最多重试 5 次，每次间隔 1 秒

### 4. 优化错误处理
- 增加初始化延迟（从 1 秒增加到 2 秒）
- 消息重试间隔增加（从 0.5s 增加到 1s）
- 检查 `chrome.runtime.id` 确保 extension context 有效
- 添加详细的日志输出

## 测试步骤

### 1. 重新加载扩展
1. 打开 Chrome 扩展管理页面：`chrome://extensions/`
2. 找到 Link Pilot 扩展
3. 点击"重新加载"按钮

### 2. 测试浮动采集器
1. 打开任意网站（非 Ahrefs 网站）
2. 等待 2-3 秒，应该看到右侧出现"采集外链"按钮
3. 打开开发者工具（F12），查看 Console
4. 应该看到以下日志：
   ```
   [Floating Collector] 等待 background script (1/5)...
   [Floating Collector] Background script 已准备好
   [Floating Collector] 检查域名是否已采集: example.com
   [Floating Collector] 检查结果: 未采集
   ```

### 3. 测试采集功能
1. 点击"采集外链"按钮
2. 应该会打开一个新标签页，访问 Ahrefs
3. 等待页面加载和数据采集
4. 查看 Console 日志：
   ```
   [Collection Manager] 收到消息: START_MANUAL_COLLECTION
   [Collection Manager] 开始手动采集: https://example.com
   [Collection Manager] 已打开 Ahrefs 页面，标签页 ID: xxx
   [Collection Manager] 页面加载完成
   [Collection Manager] 启动 API 拦截器
   [Collection Manager] 等待采集完成...
   [Collection Manager] 采集成功，共 X 条
   ```

### 4. 验证错误修复
如果仍然出现连接错误：
1. 检查 background script 是否正确加载
2. 查看 background script 的 Console（在扩展管理页面点击"Service Worker"）
3. 确认看到以下日志：
   ```
   [Message Router] 消息路由器已初始化
   [Background] Background script loaded and ready
   [Background] 已注册的消息类型: ["PING", "CHECK_IF_COLLECTED", "START_MANUAL_COLLECTION", ...]
   ```

## 关键改进

### 消息路由器
```typescript
// 注册消息处理器
messageRouter.register('MESSAGE_TYPE', (message, sender, sendResponse) => {
  // 处理逻辑
  sendResponse({ success: true });
  return true; // 异步响应
});

// 初始化（在 background/index.ts 中）
messageRouter.init();
```

### 健康检查
```typescript
// 等待 background script 准备好
private async waitForBackgroundReady(maxAttempts: number = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      if (!chrome.runtime?.id) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      await chrome.runtime.sendMessage({ type: 'PING' });
      return true;
    } catch (error) {
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  return false;
}
```

## 预期结果
- ✅ 不再出现 "Could not establish connection" 错误
- ✅ 浮动采集器正常显示
- ✅ 采集功能正常工作
- ✅ 所有消息都能被正确路由和处理
