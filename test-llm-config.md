# LLM 功能测试指南

## 已实现的功能

### 1. 配置项（ExtensionSettings）
- `enable_llm_comment`: 启用 LLM 生成评论（默认 false）
- `llm_provider`: API 提供商（'openai' | 'anthropic' | 'custom'，默认 'openai'）
- `llm_api_key`: API Key（默认空）
- `llm_model`: 模型名称（默认 'gpt-4o-mini'）
- `llm_custom_endpoint`: 自定义 API 端点（可选）

### 2. 消息类型
- `GENERATE_LLM_COMMENT`: 生成 LLM 评论请求

### 3. 实现位置
- **Background Service**: `chrome-extension/src/background/llm-service.ts`
- **Message Router**: `chrome-extension/src/background/message-router.ts`
- **Content Script**: `pages/content/src/handlers/message-handler.ts`

### 4. 工作流程
1. 用户点击"一键填充"
2. Content Script 调用 `buildAutoComment()`
3. 检查是否启用 LLM（`enable_llm_comment` && `llm_api_key`）
4. 如果启用，发送消息到 Background Service
5. Background Service 调用 LLM API
6. 返回生成的评论或回退到模板

## 本地测试配置

### 使用 Ollama 本地 LLM

1. **安装 Ollama**
```bash
# macOS
brew install ollama

# 启动服务
ollama serve
```

2. **下载模型**
```bash
# 下载 qwen2.5 模型（推荐，中文支持好）
ollama pull qwen2.5:7b

# 或者使用 llama3
ollama pull llama3:8b
```

3. **配置扩展**
在 Options 页面设置：
```json
{
  "enable_llm_comment": true,
  "llm_provider": "custom",
  "llm_api_key": "ollama",
  "llm_model": "qwen2.5:7b",
  "llm_custom_endpoint": "http://localhost:11434/v1/chat/completions"
}
```

### 使用 OpenAI API

```json
{
  "enable_llm_comment": true,
  "llm_provider": "openai",
  "llm_api_key": "sk-xxx",
  "llm_model": "gpt-4o-mini"
}
```

### 使用 Anthropic API

```json
{
  "enable_llm_comment": true,
  "llm_provider": "anthropic",
  "llm_api_key": "sk-ant-xxx",
  "llm_model": "claude-3-5-sonnet-20241022"
}
```

## 测试步骤

1. **配置 LLM**
   - 打开扩展的 Options 页面
   - 在设置中添加 LLM 配置
   - 保存设置

2. **测试评论生成**
   - 打开任意博客文章页面
   - 打开 Side Panel
   - 选择一个网站资料
   - 点击"一键填充"
   - 检查评论框是否填充了 LLM 生成的内容

3. **查看日志**
   - 打开 Chrome DevTools
   - 切换到 Console
   - 查看 `[Content Script]` 和 `[LLM Service]` 的日志

## 预期行为

### 成功场景
- Console 显示：`[Content Script] LLM 生成评论成功`
- 评论框填充了个性化、自然的评论内容
- 评论提到了博客文章的具体内容
- 评论自然地引用了你的网站

### 失败回退场景
- Console 显示：`[Content Script] LLM 生成评论失败，回退到模板`
- 评论框填充了模板生成的内容（固定句式）
- 不影响正常填表流程

## 调试技巧

### 1. 测试 Ollama 连接
```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5:7b",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 2. 查看 Background Service 日志
- 打开 `chrome://extensions/`
- 找到 Link Pilot 扩展
- 点击 "Service Worker" 查看日志

### 3. 手动触发 LLM 调用
在 Content Script Console 中执行：
```javascript
chrome.runtime.sendMessage({
  type: 'GENERATE_LLM_COMMENT',
  payload: {
    pageTitle: '测试标题',
    pageDescription: '测试描述',
    pageH1: '测试 H1',
    pageUrl: window.location.href,
    websiteName: '我的网站',
    websiteUrl: 'https://example.com',
    websiteDescription: '网站简介',
    backlinkNote: '备注'
  }
}).then(console.log);
```

## 常见问题

### Q: LLM 调用失败
A: 检查：
1. API Key 是否正确
2. 网络连接是否正常
3. Ollama 服务是否运行（本地）
4. 模型是否已下载（本地）

### Q: 评论质量不好
A: 调整：
1. 更换更强大的模型（如 gpt-4o）
2. 确保页面有清晰的标题和描述
3. 在网站资料中添加更详细的简介

### Q: 响应太慢
A: 优化：
1. 使用更小的模型（如 gpt-4o-mini）
2. 使用本地 Ollama（无网络延迟）
3. 考虑添加缓存机制
