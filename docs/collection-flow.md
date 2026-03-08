# 外链采集流程说明

## 采集步骤

### 1. 浮动采集按钮初始化
- 在非 Ahrefs 页面上，content script 会显示一个浮动的"采集外链"按钮
- 按钮会先检查当前域名是否已经采集过
- 如果已采集，则不显示按钮

### 2. 用户点击采集按钮
- 用户点击浮动按钮后，会发送 `START_MANUAL_COLLECTION` 消息到 background script
- 消息包含当前页面的 URL（`window.location.origin`）

### 3. Background Script 处理采集请求
- Background script 收到消息后，执行以下步骤：
  1. 构造 Ahrefs 外链分析页面 URL
  2. 打开新标签页访问 Ahrefs
  3. 等待页面加载完成
  4. 等待 3 秒让 Ahrefs 加载数据
  5. 向该标签页的 content script 发送 `START_API_INTERCEPTOR` 消息

### 4. Content Script 启动 API 拦截器
- Ahrefs 页面的 content script 收到消息后：
  1. 创建 API 拦截器实例
  2. 拦截器会监听 Ahrefs 的 API 请求
  3. 从 API 响应中提取外链数据
  4. 当收集到足够数量的外链后，发送 `COLLECTION_COMPLETE` 消息回 background

### 5. Background Script 保存数据
- 收到 `COLLECTION_COMPLETE` 消息后：
  1. 将采集的外链数据转换为 Opportunity 对象
  2. 保存到 storage
  3. 创建批次记录
  4. 关闭 Ahrefs 标签页
  5. 返回采集结果给浮动按钮

### 6. 浮动按钮显示结果
- 采集成功：显示"✅ 采集成功"和外链数量
- 采集失败：显示"❌ 采集失败"和错误信息
- 3 秒后按钮消失或恢复初始状态

## 关键技术点

### API 拦截
- 使用 `XMLHttpRequest` 和 `fetch` 拦截技术
- 监听 Ahrefs 的 API 请求和响应
- 从响应中解析外链数据

### 消息传递
- Content Script ↔ Background Script 使用 `chrome.runtime.sendMessage`
- Background Script → Content Script 使用 `chrome.tabs.sendMessage`
- 所有异步消息都需要返回 `true` 保持通道开启

### 错误处理
- 连接失败时自动重试（最多 3 次）
- 重试间隔逐渐增加（1s, 2s, 3s）
- 检查 extension context 是否有效
- 超时保护（页面加载 30s，采集 60s）

## 常见问题

### "Could not establish connection" 错误
**原因：**
- Background script 还未完全加载
- Extension context 失效（扩展重新加载）
- 消息监听器未正确注册

**解决方案：**
- 增加初始化延迟（2 秒）
- 实现消息重试机制
- 检查 `chrome.runtime.id` 是否存在
- 确保消息监听器返回 `true`

### 采集超时
**原因：**
- Ahrefs 页面加载慢
- API 请求延迟
- 网络问题

**解决方案：**
- 增加等待时间
- 检查网络连接
- 手动刷新 Ahrefs 页面

### 未找到外链数据
**原因：**
- 目标网站没有外链
- Ahrefs 数据未加载完成
- API 拦截器未正确工作

**解决方案：**
- 确认目标网站在 Ahrefs 中有数据
- 增加等待时间
- 检查 API 拦截器日志
