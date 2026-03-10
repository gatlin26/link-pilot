# Ahrefs 拦截器调试指南

## 问题分析

根据日志，拦截器启动了但没有拦截到数据。可能的原因：

1. ✅ 桥接脚本注入成功
2. ✅ Content script 启动成功
3. ❌ 没有拦截到 API 响应

## 已修复的问题

1. **移除重复注入**：不再手动注入桥接脚本，完全依赖 manifest 自动注入
2. **修复消息处理**：移除了已删除的 `ENSURE_AHREFS_MAIN_BRIDGE` 消息调用

## 测试步骤

### 1. 重新加载扩展

```bash
# 在 Chrome 中打开
chrome://extensions/

# 找到 Link Pilot 扩展，点击刷新按钮
```

### 2. 打开 Ahrefs 页面并检查桥接脚本

```javascript
// 在 Ahrefs 页面的控制台中运行：

// 1. 检查桥接脚本是否存在
window.__linkPilotAhrefsBridgeState__

// 应该看到：
// {
//   active: true,
//   readyForStreaming: false,
//   listenerBound: true,
//   bufferedResponses: [...],
//   ...
// }

// 2. 检查是否拦截了原始 fetch
window.fetch.toString()
// 应该看到被修改过的函数

// 3. 手动发送启动命令
window.postMessage({
  channel: '__LINK_PILOT_AHREFS_BRIDGE__',
  source: 'link_pilot_ahrefs_content',
  type: 'START_INTERCEPT'
}, '*');

// 4. 监听桥接消息
window.addEventListener('message', (e) => {
  if (e.data?.channel === '__LINK_PILOT_AHREFS_BRIDGE__') {
    console.log('🔔 桥接消息:', e.data);
  }
});
```

### 3. 测试手动采集

1. 打开扩展 Popup
2. 切换到"采集"标签
3. 输入目标 URL（例如：`https://example.com`）
4. 点击"开始采集"
5. 观察控制台输出

### 4. 查看详细日志

**Background 控制台**（右键扩展图标 → 检查弹出式窗口 → 切换到 Service Worker）：
```javascript
// 查看采集日志
chrome.storage.local.get('collection_debug_logs', (result) => {
  console.log(result.collection_debug_logs);
});
```

**Content Script 控制台**（在 Ahrefs 页面按 F12）：
- 查找 `[Link Pilot]` 开头的日志
- 查找 `[Ahrefs Interceptor]` 开头的日志
- 查找 `[Ahrefs Bridge]` 开头的日志

### 5. 检查网络请求

在 Ahrefs 页面：
1. 打开开发者工具 → Network 标签
2. 过滤：`ahrefs.com/api` 或 `backlink`
3. 查看是否有 API 请求
4. 检查请求的 URL 和响应

## 常见问题

### 问题 1：桥接脚本未加载

**症状**：`window.__linkPilotAhrefsBridgeState__` 为 `undefined`

**解决**：
1. 确认扩展已重新加载
2. 确认在 `https://ahrefs.com/*` 页面上
3. 刷新 Ahrefs 页面

### 问题 2：拦截器未捕获请求

**症状**：看到 `REQUEST_SEEN` 但没有 `API_RESPONSE`

**可能原因**：
1. URL 模式不匹配
2. 响应不是 JSON 格式
3. 请求在拦截器启动前就完成了

**解决**：
```javascript
// 在控制台查看拦截到的请求
window.addEventListener('message', (e) => {
  if (e.data?.type === 'REQUEST_SEEN') {
    console.log('👀 看到请求:', e.data.payload?.url);
  }
  if (e.data?.type === 'API_RESPONSE') {
    console.log('✅ 拦截响应:', e.data.payload?.url);
  }
});
```

### 问题 3：Ahrefs 页面没有发起 API 请求

**症状**：Network 标签中没有看到 API 请求

**可能原因**：
1. 页面使用了缓存
2. 需要手动触发搜索
3. Ahrefs 改变了 API 结构

**解决**：
1. 在 Ahrefs 输入框中输入新的 URL
2. 点击搜索按钮
3. 观察 Network 标签

## 调试命令

### 清除所有缓存
```javascript
// 在 Background 控制台
chrome.storage.local.clear();
chrome.storage.session.clear();
```

### 查看拦截器状态
```javascript
// 在 Ahrefs 页面控制台
const state = window.__linkPilotAhrefsBridgeState__;
console.log('Active:', state?.active);
console.log('Ready:', state?.readyForStreaming);
console.log('Buffered:', state?.bufferedResponses?.length);
```

### 手动触发采集
```javascript
// 在 Ahrefs 页面控制台
chrome.runtime.sendMessage({
  type: 'START_API_INTERCEPTOR',
  payload: { maxCount: 20 }
});
```

## 预期的正常日志流程

1. **页面加载**
   ```
   [Ahrefs Bridge] 开始初始化主世界桥接脚本
   [Ahrefs Bridge] 主世界桥接脚本初始化完成，拦截器已启动
   ```

2. **Content Script 加载**
   ```
   [Link Pilot] Content script loaded
   [Link Pilot] 检测到支持的平台: ahrefs
   ```

3. **启动拦截**
   ```
   [Ahrefs Interceptor] 开始拦截 API 请求
   [Ahrefs Interceptor] 拦截器已激活，等待网络请求...
   ```

4. **捕获请求**
   ```
   [Ahrefs Interceptor] fetch 请求 #1: https://ahrefs.com/api/...
   [Ahrefs Interceptor] ✓ 命中 API 请求: https://ahrefs.com/api/...
   [Ahrefs Interceptor] 响应数据结构: ["backlinks", "total", ...]
   ```

5. **采集完成**
   ```
   [Link Pilot] 拦截到外链数据，共 20 条
   [Link Pilot] 数据已保存 - 新增: 15 条, 跳过: 5 条
   ```

## 下一步

如果问题仍然存在，请提供：
1. Background 控制台的完整日志
2. Content Script 控制台的完整日志
3. Network 标签的截图（显示 API 请求）
4. `window.__linkPilotAhrefsBridgeState__` 的输出
