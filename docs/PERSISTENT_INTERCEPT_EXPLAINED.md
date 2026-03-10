# 常驻拦截工作原理

## 简答：是的，完全可以！

只要页面不关闭，拦截器会持续捕获所有 API 请求，无论你重复操作多少次。

## 详细说明

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Ahrefs 页面                               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  主世界桥接脚本 (MAIN World)                        │    │
│  │  - 在 document_start 时自动注入                     │    │
│  │  - 劫持 window.fetch 和 XMLHttpRequest             │    │
│  │  - 持续运行，直到页面关闭                           │    │
│  └────────────────────────────────────────────────────┘    │
│                         ↕ postMessage                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Content Script (ISOLATED World)                   │    │
│  │  - 监听桥接消息                                     │    │
│  │  - 解析外链数据                                     │    │
│  │  - 自动保存到 storage                               │    │
│  │  - 循环运行（每 2 秒检查一次）                      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 时间线

```
时间轴                    事件
─────────────────────────────────────────────────────────────
00:00  打开 ahrefs.com
00:01  ├─ manifest 自动注入桥接脚本
00:02  ├─ 桥接脚本劫持 fetch/XHR
00:03  ├─ Content script 加载
00:04  └─ 启动常驻拦截循环

       用户操作：输入 URL1 + 搜索
00:10  ├─ Ahrefs 发起 API 请求
00:11  ├─ 桥接脚本拦截请求
00:12  ├─ 捕获响应数据
00:13  ├─ 发送给 Content script
00:14  ├─ 解析并保存数据
00:15  └─ 继续监听...

       用户操作：输入 URL2 + 搜索
00:20  ├─ Ahrefs 发起 API 请求
00:21  ├─ 桥接脚本拦截请求（同一个拦截器）
00:22  ├─ 捕获响应数据
00:23  ├─ 发送给 Content script
00:24  ├─ 解析并保存数据
00:25  └─ 继续监听...

       用户操作：输入 URL3 + 搜索
00:30  ├─ Ahrefs 发起 API 请求
00:31  ├─ 桥接脚本拦截请求（同一个拦截器）
00:32  ├─ 捕获响应数据
00:33  ├─ 发送给 Content script
00:34  ├─ 解析并保存数据
00:35  └─ 继续监听...

       ... 无限循环，直到页面关闭
```

## 关键特性

### 1. 真正的常驻拦截

```javascript
// 桥接脚本在页面加载时就劫持了原始函数
window.fetch = async (...args) => {
  // 拦截逻辑
  const response = await originalFetch(...args);
  // 捕获响应
  return response;
};

// 这个劫持会一直生效，直到页面关闭
```

### 2. 自动循环监听

```javascript
// Content script 的循环逻辑
function startPersistentCollection() {
  collectorRegistry.startCollection(1000).then(backlinks => {
    // 保存数据
    // ...

    // 2 秒后继续下一轮
    setTimeout(() => {
      startPersistentCollection(); // 递归调用
    }, 2000);
  });
}
```

### 3. 无需手动触发

- ✅ 页面打开时自动启动
- ✅ 每次搜索自动拦截
- ✅ 数据自动保存
- ✅ 自动去重
- ✅ 持续运行

## 实际测试示例

### 场景：连续搜索 5 个网站

```
操作                          拦截结果
─────────────────────────────────────────────────────
1. 输入 example.com          ✅ 拦截到 20 条外链
   点击搜索                  ✅ 保存 20 条（新增）

2. 输入 github.com           ✅ 拦截到 20 条外链
   点击搜索                  ✅ 保存 18 条（2 条重复）

3. 输入 stackoverflow.com    ✅ 拦截到 20 条外链
   点击搜索                  ✅ 保存 20 条（新增）

4. 输入 reddit.com           ✅ 拦截到 20 条外链
   点击搜索                  ✅ 保存 15 条（5 条重复）

5. 输入 medium.com           ✅ 拦截到 20 条外链
   点击搜索                  ✅ 保存 20 条（新增）

总计：拦截 100 条，保存 93 条（去重 7 条）
```

## 控制台输出示例

```javascript
// 页面加载
[Ahrefs Bridge] 开始初始化主世界桥接脚本
[Ahrefs Bridge] 主世界桥接脚本初始化完成，拦截器已启动
[Link Pilot] Content script loaded
[Link Pilot] 检测到支持的平台: ahrefs
[Link Pilot] 立即启动常驻拦截模式
[Link Pilot] 拦截器启动，开始监听 API 请求...

// 第一次搜索
[Ahrefs Interceptor] fetch 请求 #1: https://ahrefs.com/api/...
[Ahrefs Interceptor] ✓ 命中 API 请求
[Link Pilot] 拦截到外链数据，共 20 条
[Link Pilot] 数据已保存 - 新增: 20 条, 跳过: 0 条
[Link Pilot] 本轮未拦截到数据，继续监听...

// 第二次搜索
[Ahrefs Interceptor] fetch 请求 #2: https://ahrefs.com/api/...
[Ahrefs Interceptor] ✓ 命中 API 请求
[Link Pilot] 拦截到外链数据，共 20 条
[Link Pilot] 数据已保存 - 新增: 18 条, 跳过: 2 条
[Link Pilot] 本轮未拦截到数据，继续监听...

// 第三次搜索
[Ahrefs Interceptor] fetch 请求 #3: https://ahrefs.com/api/...
[Ahrefs Interceptor] ✓ 命中 API 请求
[Link Pilot] 拦截到外链数据，共 20 条
[Link Pilot] 数据已保存 - 新增: 20 条, 跳过: 0 条
[Link Pilot] 本轮未拦截到数据，继续监听...

// ... 持续运行
```

## 优势

### 1. 零手动操作
- 不需要每次点击"开始采集"
- 不需要等待采集完成
- 不需要手动保存数据

### 2. 高效率
- 实时捕获，无延迟
- 自动去重，避免重复
- 后台运行，不影响使用

### 3. 可靠性
- 拦截器在页面级别运行
- 不受页面内容变化影响
- 错误自动重试

## 限制

### 1. 页面级别
- 拦截器绑定到单个页面
- 关闭页面后需要重新启动
- 刷新页面会重置拦截器

### 2. 同源限制
- 只能拦截当前页面的请求
- 无法拦截 iframe 中的请求
- 无法拦截跨域的某些请求

### 3. 性能考虑
- 长时间运行可能占用内存
- 大量数据可能影响性能
- 建议定期清理旧数据

## 最佳实践

### 1. 保持页面打开
```
✅ 打开 Ahrefs 页面，保持标签页激活
✅ 正常使用 Ahrefs，输入 URL 并搜索
✅ 数据自动采集和保存
```

### 2. 定期检查数据
```
1. 点击扩展图标
2. 切换到"外链"标签
3. 查看采集到的外链数量
4. 必要时导出或清理数据
```

### 3. 监控拦截状态
```javascript
// 在控制台运行，检查拦截器状态
const state = window.__linkPilotAhrefsBridgeState__;
console.log('拦截器激活:', state?.active);
console.log('已拦截响应:', state?.bufferedResponses?.length || 0);
```

## 故障排除

### 问题：拦截器停止工作

**症状**：
- 之前能拦截，现在不行了
- 控制台没有新的日志

**解决**：
```javascript
// 1. 检查拦截器状态
const state = window.__linkPilotAhrefsBridgeState__;
console.log('Active:', state?.active);

// 2. 如果未激活，重新启动
if (!state?.active) {
  window.postMessage({
    channel: '__LINK_PILOT_AHREFS_BRIDGE__',
    source: 'link_pilot_ahrefs_content',
    type: 'START_INTERCEPT'
  }, '*');
}

// 3. 如果还不行，刷新页面
location.reload();
```

### 问题：数据没有保存

**症状**：
- 控制台显示拦截成功
- 但扩展中看不到数据

**解决**：
```javascript
// 检查 storage
chrome.storage.local.get(null, (data) => {
  console.log('Storage keys:', Object.keys(data));
});

// 检查是否有错误
// 查看 Background 控制台
```

## 总结

✅ **是的，完全支持重复操作！**

只要：
1. 页面保持打开
2. 拦截器正常运行
3. Ahrefs 发起 API 请求

就能持续拦截所有搜索结果，无论重复多少次。

这正是常驻拦截的核心价值：**一次启动，持续工作**。
