# 常驻拦截测试指南

## 测试场景：重复搜索拦截

### 目标
验证在同一个 Ahrefs 页面上，多次输入不同 URL 并搜索时，拦截器能否持续捕获所有 API 请求。

## 测试步骤

### 1. 准备工作

1. **重新加载扩展**
   ```
   chrome://extensions/ → Link Pilot → 刷新
   ```

2. **打开 Ahrefs 页面**
   ```
   https://ahrefs.com/backlink-checker
   ```

3. **打开开发者工具**
   - 按 F12
   - 切换到 Console 标签

### 2. 设置监听器

在控制台中运行以下代码，监听所有拦截事件：

```javascript
// 监听拦截器消息
let requestCount = 0;
let responseCount = 0;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.channel !== '__LINK_PILOT_AHREFS_BRIDGE__') return;

  switch (data.type) {
    case 'BRIDGE_READY':
      console.log('✅ 桥接脚本就绪');
      break;

    case 'REQUEST_SEEN':
      requestCount++;
      console.log(`👀 请求 #${requestCount}:`, data.payload?.url);
      if (data.payload?.matched) {
        console.log('   ✓ 匹配 Ahrefs API 模式');
      }
      break;

    case 'API_RESPONSE':
      responseCount++;
      console.log(`📦 响应 #${responseCount}:`, data.payload?.url);
      console.log('   数据键:', Object.keys(data.payload?.data || {}));
      break;

    case 'BRIDGE_ERROR':
      console.error('❌ 桥接错误:', data.payload?.error);
      break;
  }
});

console.log('🎯 监听器已设置，开始测试...');
```

### 3. 检查桥接脚本状态

```javascript
// 检查桥接脚本
const state = window.__linkPilotAhrefsBridgeState__;
console.log('桥接脚本状态:', {
  存在: !!state,
  激活: state?.active,
  就绪: state?.readyForStreaming,
  监听器绑定: state?.listenerBound,
  缓冲响应数: state?.bufferedResponses?.length || 0
});

// 如果未激活，手动启动
if (state && !state.active) {
  console.log('⚠️ 拦截器未激活，手动启动...');
  window.postMessage({
    channel: '__LINK_PILOT_AHREFS_BRIDGE__',
    source: 'link_pilot_ahrefs_content',
    type: 'START_INTERCEPT'
  }, '*');
}
```

### 4. 执行重复搜索测试

**测试 URL 列表**（依次输入并搜索）：
1. `https://example.com`
2. `https://github.com`
3. `https://stackoverflow.com`
4. `https://reddit.com`
5. `https://medium.com`

**操作步骤**：
1. 在 Ahrefs 输入框输入第一个 URL
2. 点击搜索按钮（或按回车）
3. 等待结果加载（观察控制台输出）
4. 重复步骤 1-3，输入下一个 URL

**预期结果**：
- 每次搜索都应该看到 `REQUEST_SEEN` 消息
- 每次搜索都应该看到 `API_RESPONSE` 消息
- `requestCount` 和 `responseCount` 应该持续增加

### 5. 查看采集结果

**方法 1：通过扩展 Popup**
```
1. 点击扩展图标
2. 切换到"外链"标签
3. 查看采集到的外链数量
```

**方法 2：通过控制台**
```javascript
// 查询 storage 中的数据
chrome.storage.local.get(null, (data) => {
  const keys = Object.keys(data);
  console.log('存储的键:', keys);

  // 查找 opportunity 相关的数据
  const opportunityKeys = keys.filter(k =>
    k.includes('opportunity') ||
    k.includes('backlink')
  );
  console.log('外链相关的键:', opportunityKeys);

  opportunityKeys.forEach(key => {
    const value = data[key];
    if (Array.isArray(value)) {
      console.log(`${key}: ${value.length} 条`);
    }
  });
});
```

## 预期的控制台输出

### 第一次搜索（example.com）
```
👀 请求 #1: https://ahrefs.com/api/v1/backlinks?target=example.com
   ✓ 匹配 Ahrefs API 模式
📦 响应 #1: https://ahrefs.com/api/v1/backlinks?target=example.com
   数据键: ['backlinks', 'total', 'pages']
[Link Pilot] 拦截到外链数据，共 20 条
[Link Pilot] 数据已保存 - 新增: 20 条, 跳过: 0 条
```

### 第二次搜索（github.com）
```
👀 请求 #2: https://ahrefs.com/api/v1/backlinks?target=github.com
   ✓ 匹配 Ahrefs API 模式
📦 响应 #2: https://ahrefs.com/api/v1/backlinks?target=github.com
   数据键: ['backlinks', 'total', 'pages']
[Link Pilot] 拦截到外链数据，共 20 条
[Link Pilot] 数据已保存 - 新增: 18 条, 跳过: 2 条
```

### 第三次搜索（stackoverflow.com）
```
👀 请求 #3: https://ahrefs.com/api/v1/backlinks?target=stackoverflow.com
   ✓ 匹配 Ahrefs API 模式
📦 响应 #3: https://ahrefs.com/api/v1/backlinks?target=stackoverflow.com
   数据键: ['backlinks', 'total', 'pages']
[Link Pilot] 拦截到外链数据，共 20 条
[Link Pilot] 数据已保存 - 新增: 20 条, 跳过: 0 条
```

## 常见问题

### Q1: 第一次搜索能拦截，后续搜索拦截不到

**可能原因**：
- 拦截器被意外停止
- Content script 被卸载

**解决方法**：
```javascript
// 检查拦截器状态
const state = window.__linkPilotAhrefsBridgeState__;
if (!state?.active) {
  console.log('拦截器未激活，重新启动...');
  window.postMessage({
    channel: '__LINK_PILOT_AHREFS_BRIDGE__',
    source: 'link_pilot_ahrefs_content',
    type: 'START_INTERCEPT'
  }, '*');
}
```

### Q2: 看到请求但没有响应

**可能原因**：
- URL 模式不匹配
- 响应不是 JSON 格式

**调试方法**：
```javascript
// 查看实际的 API URL
// 在 Network 标签中找到 API 请求
// 检查 URL 是否匹配以下模式：
const patterns = [
  /api\.ahrefs\.com/i,
  /ahrefs\.com\/api/i,
  /ahrefs\.com\/v\d+\//i,
  /stGetFreeBacklinksList/i,
  /backlink.*api/i,
  /refpages/i,
  /backlinks/i,
];

// 测试 URL
const testUrl = 'YOUR_API_URL_HERE';
const matched = patterns.some(p => p.test(testUrl));
console.log('URL 匹配:', matched);
```

### Q3: 数据保存失败

**可能原因**：
- Storage 配额已满
- 数据格式错误

**检查方法**：
```javascript
// 查看 storage 使用情况
chrome.storage.local.getBytesInUse(null, (bytes) => {
  console.log('Storage 使用:', bytes, 'bytes');
  console.log('约', (bytes / 1024 / 1024).toFixed(2), 'MB');
});
```

## 性能测试

### 压力测试：连续 10 次搜索

```javascript
// 自动化测试脚本（在 Ahrefs 页面控制台运行）
const testUrls = [
  'https://example.com',
  'https://github.com',
  'https://stackoverflow.com',
  'https://reddit.com',
  'https://medium.com',
  'https://dev.to',
  'https://hashnode.com',
  'https://producthunt.com',
  'https://hackernews.com',
  'https://lobste.rs'
];

let testIndex = 0;
let capturedResponses = 0;

// 监听响应
window.addEventListener('message', (e) => {
  if (e.data?.type === 'API_RESPONSE') {
    capturedResponses++;
    console.log(`✅ 捕获响应 ${capturedResponses}/${testUrls.length}`);
  }
});

// 注意：这个脚本只是监听，实际搜索需要手动操作
// 因为我们无法直接操作 Ahrefs 的输入框（跨域限制）
console.log('准备测试 10 个 URL，请依次手动输入并搜索：');
testUrls.forEach((url, i) => {
  console.log(`${i + 1}. ${url}`);
});
```

## 成功标准

✅ **测试通过条件**：
1. 每次搜索都能看到 `REQUEST_SEEN` 消息
2. 每次搜索都能看到 `API_RESPONSE` 消息
3. 数据能正确保存到 storage
4. 拦截器在整个测试过程中保持激活状态
5. 没有出现错误或警告

❌ **测试失败条件**：
1. 某次搜索没有拦截到请求
2. 拦截器中途停止工作
3. 数据保存失败
4. 出现 JavaScript 错误

## 报告问题

如果测试失败，请提供：
1. 控制台的完整输出（包括错误信息）
2. `window.__linkPilotAhrefsBridgeState__` 的值
3. Network 标签的截图（显示 API 请求）
4. 测试时的操作步骤
5. 失败发生在第几次搜索
