# 🚀 快速开始 - LLM 功能测试

## 5 分钟快速测试

### 1. 编译扩展 (30秒)

```bash
cd /Users/xingzhi/code/link-pilot
pnpm build
```

### 2. 加载扩展 (30秒)

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用"开发者模式"（右上角开关）
4. 点击"加载已解压的扩展程序"
5. 选择 `/Users/xingzhi/code/link-pilot/dist` 目录

### 3. 配置 LLM (1分钟)

1. 点击扩展图标，打开 Popup 或 Side Panel
2. 打开 DevTools Console (F12)
3. 复制粘贴以下代码并执行：

```javascript
(async function() {
  await chrome.storage.local.set({
    'extension-settings-storage-key': {
      enable_llm_comment: true,
      llm_provider: 'anthropic',
      llm_api_key: 'sk-z0ZuQ5gq90GRH9jlwgZzhVRac7TBbDBhO4yCFHgT424zSblD',
      llm_model: 'claude-sonnet-4-6',
      llm_custom_endpoint: 'https://api.yunnet.top/v1/messages',
    }
  });
  console.log('✅ LLM 配置完成！');
})();
```

### 4. 添加测试数据 (1分钟)

打开 Options 页面，添加：

**网站资料**:
- 名称: `Link Pilot`
- URL: `https://linkpilot.com`
- 邮箱: `contact@linkpilot.com`
- ✅ 勾选"启用"

**外链**:
- URL: `https://example.com/blog`

### 5. 测试填表 (2分钟)

1. 打开测试页面：
```bash
# 拖拽文件到浏览器，或在地址栏输入：
file:///Users/xingzhi/code/link-pilot/test-llm-page.html
```

2. 打开 Side Panel
3. 选择 `Link Pilot` 网站
4. 点击"一键填充"
5. 等待 5-10 秒
6. 检查表单是否填充（包括 LLM 生成的评论）
7. 点击"提交评论"
8. 检查 Console 日志和统计数字

## ✅ 预期结果

- 表单自动填充所有字段
- 评论内容真诚、自然（100-120字）
- Console 显示成功日志
- Side Panel 统计数字更新

## 🔍 验证命令

在 Console 中执行：

```javascript
// 查看 LLM 配置
chrome.storage.local.get('extension-settings-storage-key', (r) => {
  const s = r['extension-settings-storage-key'];
  console.log('LLM 配置:', {
    enabled: s.enable_llm_comment,
    provider: s.llm_provider,
    model: s.llm_model,
  });
});

// 查看提交记录
chrome.storage.local.get('backlink-submissions-key', (r) => {
  console.log('提交记录数:', r['backlink-submissions-key']?.length || 0);
});
```

## 📝 完整文档

- `TEST-SUMMARY.md` - 测试总结
- `E2E-TEST-GUIDE.md` - 详细测试指南
- `LLM-CONFIG-GUIDE.md` - 配置指南
- `LLM-IMPLEMENTATION.md` - 实现文档

## 🎉 完成！

LLM 功能已完整实现并测试通过，可以立即使用！
