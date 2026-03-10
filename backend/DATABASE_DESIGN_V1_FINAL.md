# Link Pilot V1.0 数据表设计（最终版 - 3张表）

## 核心业务流程

```
1. 管理站点信息（我的网站）
   ↓
2. 管理外链资源（外链库 - 质量评估）
   ↓
3. 筛选匹配外链（预测哪些适合提交）
   ↓
4. 记录提交情况（提交记录）
```

---

## 数据表设计

### 1. sites - 站点表
**用途：** 管理用户自己的网站信息

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  name: string                    // 网站名称：'我的AI工具'
  url: string                     // 网站URL：'https://myaitool.com'
  domain: string                  // 域名：'myaitool.com'
  email: string                   // 联系邮箱
  type: string (nullable)         // 站点类型：'saas', 'blog', 'tool'
  description: text (nullable)    // 网站描述
  keywords: text (JSON, nullable) // 关键词：['AI', 'SaaS', 'Productivity']
  comments: text (JSON)           // 预设评论模板
  metadata: text (JSON, nullable) // 扩展字段
  enabled: boolean (default true)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, enabled

---

### 2. backlinks - 外链资源表
**用途：** 管理外链资源库（质量评估、分类管理）

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  url: string                     // 外链URL
  domain: string                  // 域名
  title: string (nullable)        // 页面标题

  // 外链分类
  type: string (nullable)         // 类型：'blog', 'forum', 'directory', 'resource_page'
  category: string (nullable)     // 分类：'tech', 'marketing', 'ai_tools'

  // 质量评估
  dr: integer (nullable)          // Domain Rating (0-100)
  traffic: integer (nullable)     // 月访问量
  quality: string (nullable)      // 质量等级：'high', 'medium', 'low'

  // 匹配信息
  tags: text (JSON, nullable)     // 标签：['SEO', 'AI', 'SaaS']
  targetAudience: string (nullable) // 目标受众

  // 管理信息
  note: text (nullable)           // 备注
  status: string                  // 状态：'active', 'inactive', 'blocked'
  flagged: boolean (default false) // 标记为重要

  metadata: text (JSON, nullable) // 扩展字段
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, domain, type, quality, status, flagged

---

### 3. submissions - 提交记录表
**用途：** 记录站点在外链上的提交情况

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  siteId: string (FK -> sites.id)        // 哪个站点
  backlinkId: string (FK -> backlinks.id) // 在哪个外链上提交

  // 提交信息
  submittedAt: timestamp          // 提交时间
  submitMode: string              // 提交模式：'manual', 'auto'

  // 提交内容
  commentUsed: text               // 使用的评论内容
  emailUsed: string (nullable)    // 使用的邮箱

  // 提交结果
  status: string                  // 状态：'pending', 'approved', 'rejected', 'failed'
  result: string (nullable)       // 结果：'success', 'failed', 'unknown'

  // 跟踪信息
  approvedAt: timestamp (nullable) // 审核通过时间
  liveUrl: string (nullable)      // 实际生效的URL

  note: text (nullable)           // 备注
  errorMessage: text (nullable)   // 错误信息
  metadata: text (JSON, nullable) // 扩展字段

  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, siteId, backlinkId, status, submittedAt

---

## 业务场景示例

### 场景1：添加外链资源
```typescript
// 用户添加一个高质量博客外链
{
  url: "https://techblog.com/submit-tool",
  domain: "techblog.com",
  title: "Submit Your AI Tool",
  type: "blog",
  category: "ai_tools",
  dr: 75,
  traffic: 50000,
  quality: "high",
  tags: ["AI", "SaaS", "Tech"],
  status: "active"
}
```

### 场景2：筛选匹配外链
```sql
-- 查询适合我的AI工具站点的高质量外链
SELECT * FROM backlinks
WHERE userId = 'xxx'
  AND quality = 'high'
  AND tags LIKE '%AI%'
  AND status = 'active'
  AND id NOT IN (
    SELECT backlinkId FROM submissions
    WHERE siteId = 'my_ai_tool_site_id'
  )
```

### 场景3：记录提交
```typescript
// 在某个外链上提交了我的AI工具
{
  siteId: "my_ai_tool_site_id",
  backlinkId: "techblog_backlink_id",
  submittedAt: "2024-03-10T10:00:00Z",
  submitMode: "manual",
  commentUsed: "Great article! Check out my AI tool...",
  status: "pending",
  result: "success"
}
```

### 场景4：更新提交状态
```typescript
// 评论被批准了
{
  status: "approved",
  approvedAt: "2024-03-11T15:00:00Z",
  liveUrl: "https://techblog.com/article#comment-123"
}
```

---

## API接口设计（13个）

### 站点管理（5个）
```
POST   /api/sites              批量同步/创建站点
GET    /api/sites              获取站点列表
GET    /api/sites/:id          获取单个站点
PUT    /api/sites/:id          更新站点
DELETE /api/sites/:id          删除站点
```

### 外链管理（5个）
```
POST   /api/backlinks          批量同步/创建外链
GET    /api/backlinks          获取外链列表（支持筛选）
GET    /api/backlinks/:id      获取单个外链
PUT    /api/backlinks/:id      更新外链
DELETE /api/backlinks/:id      删除外链
```

**查询参数示例：**
```
GET /api/backlinks?quality=high&type=blog&tags=AI&status=active&notSubmittedBy=site_id
```

### 提交记录管理（5个）
```
POST   /api/submissions        批量创建提交记录
GET    /api/submissions        获取提交记录列表
GET    /api/submissions/:id    获取单个提交记录
PUT    /api/submissions/:id    更新提交状态
DELETE /api/submissions/:id    删除提交记录
```

**查询参数示例：**
```
GET /api/submissions?siteId=xxx&status=pending&page=1&limit=20
```

### 智能匹配（可选）
```
GET    /api/backlinks/match    智能匹配外链
```

**请求参数：**
```
GET /api/backlinks/match?siteId=xxx&limit=10
```

**响应：** 返回最匹配的外链列表（根据tags、quality、未提交等条件）

---

## 数据关系

```
┌─────────────┐
│   sites     │ 我的网站
│  (1个站点)  │
└──────┬──────┘
       │
       │ 1:N
       │
       ↓
┌─────────────────┐      ┌──────────────┐
│  submissions    │ N:1  │  backlinks   │ 外链资源库
│   (提交记录)    │─────→│ (外链质量库) │
└─────────────────┘      └──────────────┘
```

**关系说明：**
- 1个站点可以在多个外链上提交（1:N）
- 1个外链可以被多个站点提交（N:1）
- submissions 是中间表，记录提交关系和状态

---

## 核心功能流程

### 1. 初始化
```
用户 → 添加站点信息 → 添加外链资源
```

### 2. 筛选外链
```
用户 → 选择站点 → 系统推荐匹配外链 → 用户筛选
```

### 3. 提交外链
```
用户 → 打开外链 → 自动填充 → 提交 → 记录提交
```

### 4. 跟踪管理
```
用户 → 查看提交记录 → 更新状态（pending/approved/rejected）
```

---

## 扩展字段说明

### metadata 字段用途
可以灵活存储未来需要的字段，例如：

**sites.metadata:**
```json
{
  "logo": "https://...",
  "socialMedia": {
    "twitter": "@myaitool",
    "linkedin": "..."
  },
  "targetMarket": ["US", "EU"]
}
```

**backlinks.metadata:**
```json
{
  "lastChecked": "2024-03-10",
  "responseTime": "2-3 days",
  "moderationLevel": "strict",
  "submissionGuidelines": "..."
}
```

**submissions.metadata:**
```json
{
  "ipAddress": "1.2.3.4",
  "userAgent": "...",
  "formFields": {...},
  "screenshots": ["url1", "url2"]
}
```

---

## 总结

### ✅ 3张表，清晰的职责划分
1. **sites** - 我的网站信息
2. **backlinks** - 外链资源库（质量管理）
3. **submissions** - 提交记录（跟踪管理）

### ✅ 支持完整的业务流程
- 外链质量评估
- 智能匹配筛选
- 提交记录跟踪
- 状态管理

### ✅ 灵活可扩展
- 使用 type/category 字段分类
- 使用 metadata 字段扩展
- 支持复杂查询和筛选
