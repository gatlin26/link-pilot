# Link Pilot 后台集成文档

## 概述

本文档描述了link-pilot浏览器扩展与buildway后台的集成方案。

## 架构

```
[link-pilot扩展]
    ↓ HTTP API
[buildway后台]
    ↓
[PostgreSQL数据库]
    ↓
[EvoLink AI (Gemini 2.5 Flash)]
```

## 数据库表结构

### 1. backlinks - 外链表
存储从Ahrefs等平台采集的外链数据。

**字段：**
- `id` - 唯一标识
- `userId` - 用户ID（关联user表）
- `sourcePlatform` - 数据来源平台
- `collectionBatchId` - 收集批次ID
- `targetDomain` - 目标域名
- `targetUrl` - 目标URL
- `referringPageUrl` - 引用页面URL
- `status` - 状态
- 其他元数据字段

**索引：**
- userId, status, collectedAt, targetDomain, batchId

### 2. opportunities - 机会表
存储可提交的外链机会。

**字段：**
- `id` - 唯一标识
- `userId` - 用户ID
- `backlinkId` - 关联的外链ID
- `url` - 机会URL
- `domain` - 域名
- `pageType` - 页面类型
- `status` - 状态
- 其他配置字段

**索引：**
- userId, status, backlinkId, domain

### 3. siteTemplates - 站点模板表
存储表单字段映射配置。

**字段：**
- `id` - 唯一标识
- `userId` - 用户ID
- `domain` - 域名
- `pageType` - 页面类型
- `fieldMappings` - 字段映射（JSON）
- `submitSelector` - 提交按钮选择器
- `version` - 版本号

**索引：**
- userId, domain, pageType

### 4. submissions - 提交记录表
存储提交历史记录。

**字段：**
- `id` - 唯一标识
- `userId` - 用户ID
- `opportunityId` - 关联的机会ID
- `domain` - 域名
- `pageUrl` - 页面URL
- `submitMode` - 提交模式
- `result` - 提交结果
- `commentExcerpt` - 评论摘要

**索引：**
- userId, opportunityId, result, createdAt

## API接口

所有接口都需要Better Auth认证，通过Cookie中的`better-auth.session_token`验证。

### 1. POST /api/link-pilot/ping
健康检查接口。

**请求：** 无需参数

**响应：**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0"
  }
}
```

### 2. POST /api/link-pilot/backlinks
批量同步外链数据。

**请求：**
```json
{
  "backlinks": [
    {
      "id": "string",
      "source_platform": "string",
      "collection_batch_id": "string",
      "collected_at": "ISO8601",
      "target_domain": "string",
      "target_url": "string",
      "referring_page_url": "string",
      "referring_domain": "string",
      "anchor_text": "string",
      "page_title": "string",
      "raw_metrics": {},
      "raw_snapshot": "string",
      "status": "string",
      ...
    }
  ]
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "total": 10,
    "success": 9,
    "failed": 1,
    "errors": ["id1: error message"]
  }
}
```

### 3. POST /api/link-pilot/opportunities
批量同步机会数据。

**请求/响应格式：** 类似backlinks接口

### 4. POST /api/link-pilot/templates
批量同步模板数据。

**请求/响应格式：** 类似backlinks接口

### 5. POST /api/link-pilot/submissions
批量同步提交记录。

**请求/响应格式：** 类似backlinks接口

### 6. POST /api/link-pilot/generate-comment
AI生成评论（使用EvoLink AI - Gemini 2.5 Flash）。

**请求：**
```json
{
  "pageTitle": "文章标题",
  "pageContent": "文章内容摘要",
  "pageUrl": "https://example.com/article",
  "websiteName": "我的网站",
  "websiteUrl": "https://mysite.com",
  "tone": "friendly",
  "language": "en"
}
```

**参数说明：**
- `tone`: "professional" | "casual" | "friendly"
- `language`: "en" | "zh" | "zh-CN" | "zh-TW" | "ja" | "ko" | "es" | "fr" | "de"

**响应：**
```json
{
  "success": true,
  "data": {
    "comment": "主评论内容",
    "alternatives": ["备选评论1", "备选评论2"]
  }
}
```

## 环境变量配置

在`backend/.env.local`中配置：

```bash
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/linkpilot"

# Better Auth
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:3000"

# EvoLink AI
EVOLINK_API_KEY="sk-xxx"
EVOLINK_MODEL="gemini-2.5-flash"

# Poll Token Secret（用于webhook）
POLL_TOKEN_SECRET="your-poll-token-secret"
```

## 部署步骤

### 1. 安装依赖
```bash
cd backend
pnpm install
```

### 2. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 填入配置
```

### 3. 生成并运行数据库迁移
```bash
pnpm db:generate
pnpm db:migrate
```

### 4. 启动开发服务器
```bash
pnpm dev
```

### 5. 生产部署
```bash
# Vercel部署
vercel --prod

# 或Docker部署
docker build -t link-pilot-backend .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e EVOLINK_API_KEY="..." \
  link-pilot-backend
```

## 前端集成

前端需要修改以下文件：

1. **API客户端** - `/packages/shared/lib/services/sheets-api-client.ts`
   - 更新API路径前缀
   - 添加认证头

2. **认证存储** - `/packages/storage/lib/impl/auth-storage.ts`
   - 存储用户token和信息

3. **AI客户端** - `/packages/shared/lib/services/ai-comment-client.ts`
   - 调用generate-comment接口

4. **评论生成器** - `/pages/popup/src/utils/comment-generator.ts`
   - 集成AI生成功能
   - 保留模板降级方案

5. **设置页面** - `/pages/options/src/components/AiSettings.tsx`
   - 配置后台URL
   - 测试连接
   - AI功能开关

## 测试

### 健康检查
```bash
curl -X POST http://localhost:3000/api/link-pilot/ping
```

### 外链同步（需要认证）
```bash
curl -X POST http://localhost:3000/api/link-pilot/backlinks \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" \
  -d '{"backlinks": [...]}'
```

### AI评论生成
```bash
curl -X POST http://localhost:3000/api/link-pilot/generate-comment \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" \
  -d '{
    "pageTitle": "测试文章",
    "pageContent": "这是一篇测试文章",
    "pageUrl": "https://example.com",
    "websiteName": "我的网站",
    "websiteUrl": "https://mysite.com"
  }'
```

## 技术栈

- **框架：** Next.js 15 + App Router
- **数据库：** PostgreSQL + Drizzle ORM
- **认证：** Better Auth
- **AI：** EvoLink AI (Gemini 2.5 Flash)
- **验证：** Zod
- **部署：** Vercel / Docker

## 注意事项

1. **认证安全：** 所有API接口都需要Better Auth认证
2. **批量操作：** 支持upsert，避免重复数据
3. **错误处理：** 统一的错误响应格式
4. **AI降级：** 前端应保留模板评论作为降级方案
5. **速率限制：** 建议在生产环境添加速率限制
6. **数据清理：** 定期清理过期的提交记录

## 下一步

1. 完成前端集成
2. 添加单元测试
3. 配置生产环境
4. 监控和日志
5. 性能优化
