# Google Sheets 同步功能 - 快速开始

## 5 分钟快速部署

### 步骤 1: 创建 Google Sheets (1 分钟)

1. 访问 https://sheets.google.com
2. 创建新的空白表格
3. 命名为 "Link Pilot Data"

### 步骤 2: 部署 GAS Web App (2 分钟)

1. 在 Google Sheets 中，点击 **扩展程序 > Apps Script**
2. 删除默认代码
3. 复制 [gas-setup-guide.md](./gas-setup-guide.md) 中的完整 GAS 代码
4. 粘贴到编辑器
5. 点击 **部署 > 新建部署 > Web 应用**
6. 配置：
   - 执行身份：我
   - 有权访问的用户：**任何人**（重要！）
7. 点击 **部署** 并授权
8. 复制生成的 Web App URL

### 步骤 3: 配置插件 (1 分钟)

1. 打开插件 Options 页面
2. 找到 "Google Sheets 同步" 设置
3. 粘贴 Web App URL
4. 点击 "测试连接"
5. 测试成功后点击 "保存"

### 步骤 4: 开始使用 (1 分钟)

完成！插件会自动：
- 将新数据加入同步队列
- 每 5 分钟自动同步到 Google Sheets
- 失败任务自动重试

你也可以点击 "立即同步" 手动触发同步。

## 验证部署

### 方法 1: 在插件中验证

1. 收集一些外链数据
2. 打开 Options 页面
3. 点击 "立即同步"
4. 查看 Google Sheets，应该能看到数据

### 方法 2: 使用测试脚本

在浏览器控制台运行：

```javascript
// 加载测试脚本
import { runAllTests } from './docs/sync-integration-test.ts';

// 运行所有测试
await runAllTests();
```

## 常见问题

### Q: 授权时提示不安全？
A: 这是正常的。点击 "高级 > 前往..." 继续授权。

### Q: 测试连接失败？
A: 检查：
1. Web App URL 是否正确
2. 部署时是否选择了 "有权访问的用户：任何人"
3. 网络连接是否正常

### Q: 数据没有同步？
A: 检查：
1. 是否有待同步的数据
2. 查看浏览器控制台是否有错误
3. 查看 GAS 执行日志（Apps Script 编辑器 > 执行 > 查看执行日志）

## 下一步

- 阅读 [完整部署指南](./gas-setup-guide.md)
- 查看 [使用示例](./sync-usage-examples.md)
- 了解 [功能概述](./sync-feature-overview.md)

## 技术支持

遇到问题？请访问项目 GitHub 仓库提交 Issue。
