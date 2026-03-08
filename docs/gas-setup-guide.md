# Google Apps Script 部署指南

本指南将帮助你部署 Google Apps Script (GAS) Web App，用于将插件数据同步到 Google Sheets。

## 前置要求

- Google 账号
- 一个 Google Sheets 文档（用于存储数据）

## 部署步骤

### 1. 创建 Google Sheets

1. 访问 [Google Sheets](https://sheets.google.com)
2. 创建一个新的空白表格
3. 将表格命名为 "Link Pilot Data"（或其他你喜欢的名称）

### 2. 打开 Apps Script 编辑器

1. 在 Google Sheets 中，点击菜单 **扩展程序 > Apps Script**
2. 删除默认的 `myFunction()` 代码
3. 将下面的完整代码复制粘贴到编辑器中

### 3. 复制 GAS 代码

```javascript
/**
 * Link Pilot - Google Sheets 同步服务
 * 提供 RESTful API 接口用于数据同步
 */

// Sheet 名称常量
const SHEET_NAMES = {
  BACKLINKS: 'collected_backlinks',
  OPPORTUNITIES: 'opportunities',
  TEMPLATES: 'site_templates',
  SUBMISSIONS: 'submissions'
};

// 列定义
const COLUMNS = {
  BACKLINKS: [
    'id', 'source_platform', 'collection_batch_id', 'collected_at',
    'target_domain', 'target_url', 'referring_page_url', 'referring_domain',
    'anchor_text', 'page_title', 'raw_metrics', 'raw_snapshot',
    'site_summary', 'link_type', 'site_business_types',
    'context_match_score', 'context_match_note', 'status', 'notes',
    'created_at', 'updated_at'
  ],
  OPPORTUNITIES: [
    'id', 'collected_backlink_id', 'url', 'domain', 'page_type',
    'path_pattern', 'link_type', 'site_summary', 'site_business_types',
    'context_match_score', 'context_match_note', 'can_submit',
    'can_auto_fill', 'can_auto_submit', 'status', 'notes',
    'created_at', 'updated_at'
  ],
  TEMPLATES: [
    'id', 'domain', 'page_type', 'path_pattern', 'field_mappings',
    'submit_selector', 'version', 'updated_at'
  ],
  SUBMISSIONS: [
    'id', 'opportunity_id', 'domain', 'page_url', 'submit_mode',
    'did_click_submit', 'result', 'comment_excerpt', 'error_message',
    'created_at'
  ]
};

/**
 * 处理 POST 请求
 */
function doPost(e) {
  try {
    // 解析请求
    const params = JSON.parse(e.postData.contents);
    const path = e.parameter.path || '';

    // 路由分发
    let result;
    switch (path) {
      case '/api/backlinks':
        result = handleBacklinks(params.backlinks);
        break;
      case '/api/opportunities':
        result = handleOpportunities(params.opportunities);
        break;
      case '/api/templates':
        result = handleTemplates(params.templates);
        break;
      case '/api/submissions':
        result = handleSubmissions(params.submissions);
        break;
      case '/api/ping':
        result = { success: true, data: { version: '1.0.0' } };
        break;
      default:
        result = { success: false, error: '未知的 API 路径' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 处理外链同步
 */
function handleBacklinks(backlinks) {
  if (!backlinks || !Array.isArray(backlinks)) {
    return { success: false, error: '无效的数据格式' };
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.BACKLINKS, COLUMNS.BACKLINKS);
  return batchWrite(sheet, backlinks, COLUMNS.BACKLINKS);
}

/**
 * 处理机会同步
 */
function handleOpportunities(opportunities) {
  if (!opportunities || !Array.isArray(opportunities)) {
    return { success: false, error: '无效的数据格式' };
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.OPPORTUNITIES, COLUMNS.OPPORTUNITIES);
  return batchWrite(sheet, opportunities, COLUMNS.OPPORTUNITIES);
}

/**
 * 处理模板同步
 */
function handleTemplates(templates) {
  if (!templates || !Array.isArray(templates)) {
    return { success: false, error: '无效的数据格式' };
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.TEMPLATES, COLUMNS.TEMPLATES);
  return batchWrite(sheet, templates, COLUMNS.TEMPLATES);
}

/**
 * 处理提交记录同步
 */
function handleSubmissions(submissions) {
  if (!submissions || !Array.isArray(submissions)) {
    return { success: false, error: '无效的数据格式' };
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.SUBMISSIONS, COLUMNS.SUBMISSIONS);
  return batchWrite(sheet, submissions, COLUMNS.SUBMISSIONS);
}

/**
 * 获取或创建 Sheet
 */
function getOrCreateSheet(sheetName, columns) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // 写入表头
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    // 冻结表头
    sheet.setFrozenRows(1);
    // 设置表头样式
    sheet.getRange(1, 1, 1, columns.length)
      .setFontWeight('bold')
      .setBackground('#f3f3f3');
  }

  return sheet;
}

/**
 * 批量写入数据
 */
function batchWrite(sheet, data, columns) {
  const result = {
    success: true,
    data: {
      total: data.length,
      success: 0,
      failed: 0,
      errors: []
    }
  };

  try {
    // 获取现有数据的 ID 列
    const lastRow = sheet.getLastRow();
    const existingIds = new Set();

    if (lastRow > 1) {
      const idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      idColumn.forEach(row => {
        if (row[0]) existingIds.add(row[0]);
      });
    }

    // 准备写入的数据
    const rowsToAppend = [];
    const rowsToUpdate = [];

    data.forEach((item, index) => {
      try {
        const row = columns.map(col => {
          const value = item[col];

          // 处理特殊类型
          if (value === null || value === undefined) {
            return '';
          }
          if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          if (Array.isArray(value)) {
            return value.join(', ');
          }
          return value;
        });

        if (existingIds.has(item.id)) {
          // 更新现有行
          rowsToUpdate.push({ id: item.id, row });
        } else {
          // 新增行
          rowsToAppend.push(row);
        }

        result.data.success++;
      } catch (error) {
        result.data.failed++;
        result.data.errors.push({
          index,
          error: error.toString()
        });
      }
    });

    // 批量追加新行
    if (rowsToAppend.length > 0) {
      sheet.getRange(lastRow + 1, 1, rowsToAppend.length, columns.length)
        .setValues(rowsToAppend);
    }

    // 批量更新现有行
    if (rowsToUpdate.length > 0) {
      rowsToUpdate.forEach(({ id, row }) => {
        const idColumn = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
        const rowIndex = idColumn.findIndex(r => r[0] === id);
        if (rowIndex !== -1) {
          sheet.getRange(rowIndex + 2, 1, 1, columns.length).setValues([row]);
        }
      });
    }

  } catch (error) {
    result.success = false;
    result.error = error.toString();
  }

  return result;
}

/**
 * 测试函数 - 用于验证部署
 */
function testDeployment() {
  Logger.log('部署测试成功！');
  return true;
}
```

### 4. 部署为 Web App

1. 点击编辑器右上角的 **部署 > 新建部署**
2. 点击 **选择类型 > Web 应用**
3. 配置部署参数：
   - **说明**：填写 "Link Pilot Sync API v1.0"
   - **执行身份**：选择 "我"
   - **有权访问的用户**：选择 "任何人"（重要：必须选择此项才能从插件访问）
4. 点击 **部署**
5. 首次部署需要授权：
   - 点击 **授权访问**
   - 选择你的 Google 账号
   - 点击 **高级 > 前往"Link Pilot Sync API"（不安全）**
   - 点击 **允许**
6. 复制生成的 **Web 应用 URL**（格式类似：`https://script.google.com/macros/s/AKfycby.../exec`）

### 5. 配置插件

1. 打开浏览器插件的 Options 页面
2. 找到 "Google Sheets 同步" 设置
3. 将复制的 Web App URL 粘贴到 "Web App URL" 输入框
4. 点击 "测试连接" 验证配置
5. 如果测试成功，点击 "保存"

## API 接口说明

部署后的 Web App 提供以下接口：

### POST /api/backlinks
同步已收集外链数据

**请求体：**
```json
{
  "backlinks": [
    {
      "id": "uuid",
      "source_platform": "ahrefs",
      "target_url": "https://example.com",
      ...
    }
  ]
}
```

### POST /api/opportunities
同步机会数据

**请求体：**
```json
{
  "opportunities": [
    {
      "id": "uuid",
      "url": "https://example.com",
      ...
    }
  ]
}
```

### POST /api/templates
同步站点模板数据

**请求体：**
```json
{
  "templates": [
    {
      "id": "uuid",
      "domain": "example.com",
      ...
    }
  ]
}
```

### POST /api/submissions
同步提交记录数据

**请求体：**
```json
{
  "submissions": [
    {
      "id": "uuid",
      "opportunity_id": "uuid",
      ...
    }
  ]
}
```

### POST /api/ping
测试连接

**响应：**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0"
  }
}
```

## 数据结构

部署后会自动创建 4 个 Sheet：

1. **collected_backlinks** - 已收集外链
2. **opportunities** - 机会池
3. **site_templates** - 站点模板
4. **submissions** - 提交记录

每个 Sheet 的列结构与插件数据模型一致。

## 常见问题

### Q: 部署后无法访问？
A: 确保在部署时选择了 "有权访问的用户：任何人"。

### Q: 授权时提示不安全？
A: 这是正常的，因为这是你自己的脚本。点击 "高级 > 前往..." 继续授权。

### Q: 如何更新脚本？
A: 修改代码后，点击 "部署 > 管理部署 > 编辑 > 版本：新版本 > 部署"。Web App URL 保持不变。

### Q: 如何查看同步日志？
A: 在 Apps Script 编辑器中，点击 "执行 > 查看执行日志"。

### Q: 数据量大时同步很慢？
A: GAS 有执行时间限制（6 分钟）。插件会自动分批同步（每批 50 条），避免超时。

## 安全建议

1. **不要分享 Web App URL**：URL 中包含访问令牌，泄露后他人可以写入你的 Sheet
2. **定期检查数据**：定期查看 Sheet 中的数据，确保没有异常
3. **备份数据**：定期导出 Sheet 数据作为备份
4. **限制访问**：如果可能，使用 Google Workspace 账号并限制访问范围

## 技术支持

如有问题，请访问项目 GitHub 仓库提交 Issue。
