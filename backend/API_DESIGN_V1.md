# Link Pilot V1.0 API 路径设计（优化版）

## API 路径设计原则

1. **第一层**：资源类型（sites/backlinks）
2. **第二层**：具体操作或子资源
3. **RESTful 风格**：使用标准HTTP方法

---

## 一、网站管理 API

### 基础路径：`/api/link-pilot/sites`

#### 1. 网站分组管理
```
POST   /api/link-pilot/sites/groups              创建网站分组
GET    /api/link-pilot/sites/groups              获取网站分组列表
GET    /api/link-pilot/sites/groups/:id          获取单个分组详情
PUT    /api/link-pilot/sites/groups/:id          更新分组
DELETE /api/link-pilot/sites/groups/:id          删除分组
```

#### 2. 网站资料管理
```
POST   /api/link-pilot/sites                     批量同步网站资料
GET    /api/link-pilot/sites                     获取网站资料列表
GET    /api/link-pilot/sites/:id                 获取单个网站详情
PUT    /api/link-pilot/sites/:id                 更新网站资料
DELETE /api/link-pilot/sites/:id                 删除网站资料
```

**查询参数示例：**
```
GET /api/link-pilot/sites?groupId=xxx&enabled=true&page=1&limit=50
```

---

## 二、外链管理 API

### 基础路径：`/api/link-pilot/backlinks`

#### 1. 外链分组管理
```
POST   /api/link-pilot/backlinks/groups          创建外链分组
GET    /api/link-pilot/backlinks/groups          获取外链分组列表
GET    /api/link-pilot/backlinks/groups/:id      获取单个分组详情
PUT    /api/link-pilot/backlinks/groups/:id      更新分组
DELETE /api/link-pilot/backlinks/groups/:id      删除分组
```

#### 2. 外链管理
```
POST   /api/link-pilot/backlinks                 批量同步外链
GET    /api/link-pilot/backlinks                 获取外链列表
GET    /api/link-pilot/backlinks/:id             获取单个外链详情
PUT    /api/link-pilot/backlinks/:id             更新外链
DELETE /api/link-pilot/backlinks/:id             删除外链
```

**查询参数示例：**
```
GET /api/link-pilot/backlinks?groupId=xxx&flagged=true&domain=example.com&page=1&limit=50
```

---

## 三、辅助功能 API

### 1. 健康检查
```
POST   /api/link-pilot/ping                      健康检查
```

### 2. 统计数据（可选）
```
GET    /api/link-pilot/stats                     获取统计数据
GET    /api/link-pilot/stats/sites               网站统计
GET    /api/link-pilot/stats/backlinks           外链统计
```

---

## 完整API列表（16个核心接口）

### 网站管理（10个）
1. `POST   /api/link-pilot/sites/groups` - 创建网站分组
2. `GET    /api/link-pilot/sites/groups` - 获取网站分组列表
3. `GET    /api/link-pilot/sites/groups/:id` - 获取分组详情
4. `PUT    /api/link-pilot/sites/groups/:id` - 更新分组
5. `DELETE /api/link-pilot/sites/groups/:id` - 删除分组
6. `POST   /api/link-pilot/sites` - 批量同步网站
7. `GET    /api/link-pilot/sites` - 获取网站列表
8. `GET    /api/link-pilot/sites/:id` - 获取网站详情
9. `PUT    /api/link-pilot/sites/:id` - 更新网站
10. `DELETE /api/link-pilot/sites/:id` - 删除网站

### 外链管理（10个）
11. `POST   /api/link-pilot/backlinks/groups` - 创建外链分组
12. `GET    /api/link-pilot/backlinks/groups` - 获取外链分组列表
13. `GET    /api/link-pilot/backlinks/groups/:id` - 获取分组详情
14. `PUT    /api/link-pilot/backlinks/groups/:id` - 更新分组
15. `DELETE /api/link-pilot/backlinks/groups/:id` - 删除分组
16. `POST   /api/link-pilot/backlinks` - 批量同步外链
17. `GET    /api/link-pilot/backlinks` - 获取外链列表
18. `GET    /api/link-pilot/backlinks/:id` - 获取外链详情
19. `PUT    /api/link-pilot/backlinks/:id` - 更新外链
20. `DELETE /api/link-pilot/backlinks/:id` - 删除外链

---

## 目录结构

```
backend/src/app/api/link-pilot/
├── ping/
│   └── route.ts                    # 健康检查
├── sites/
│   ├── route.ts                    # POST/GET 网站列表
│   ├── [id]/
│   │   └── route.ts                # GET/PUT/DELETE 单个网站
│   └── groups/
│       ├── route.ts                # POST/GET 分组列表
│       └── [id]/
│           └── route.ts            # GET/PUT/DELETE 单个分组
└── backlinks/
    ├── route.ts                    # POST/GET 外链列表
    ├── [id]/
    │   └── route.ts                # GET/PUT/DELETE 单个外链
    └── groups/
        ├── route.ts                # POST/GET 分组列表
        └── [id]/
            └── route.ts            # GET/PUT/DELETE 单个分组
```

---

## 请求/响应示例

### 1. 创建网站分组
```http
POST /api/link-pilot/sites/groups
Content-Type: application/json

{
  "name": "SaaS产品"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "group_xxx",
    "userId": "user_xxx",
    "name": "SaaS产品",
    "websiteCount": 0,
    "createdAt": "2024-03-10T10:00:00Z",
    "updatedAt": "2024-03-10T10:00:00Z"
  }
}
```

### 2. 批量同步网站
```http
POST /api/link-pilot/sites
Content-Type: application/json

{
  "sites": [
    {
      "id": "site_1",
      "groupId": "group_xxx",
      "name": "我的AI工具",
      "url": "https://myaitool.com",
      "domain": "myaitool.com",
      "email": "contact@myaitool.com",
      "comments": ["Great article!", "Thanks for sharing!"],
      "enabled": true
    }
  ]
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "total": 1,
    "success": 1,
    "failed": 0,
    "errors": []
  }
}
```

### 3. 获取外链列表
```http
GET /api/link-pilot/backlinks?groupId=group_xxx&flagged=true&page=1&limit=20
```

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "backlink_1",
        "userId": "user_xxx",
        "groupId": "group_xxx",
        "url": "https://example.com/blog/post",
        "domain": "example.com",
        "note": "高质量博客",
        "keywords": ["SEO", "AI"],
        "dr": 75,
        "as": 68,
        "flagged": true,
        "createdAt": "2024-03-10T10:00:00Z",
        "updatedAt": "2024-03-10T10:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 4. 更新外链
```http
PUT /api/link-pilot/backlinks/backlink_1
Content-Type: application/json

{
  "note": "已提交评论",
  "flagged": false
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "backlink_1",
    "note": "已提交评论",
    "flagged": false,
    "updatedAt": "2024-03-10T11:00:00Z"
  }
}
```

---

## 统一响应格式

### 成功响应
```typescript
{
  success: true,
  data: T // 具体数据
}
```

### 错误响应
```typescript
{
  success: false,
  error: string // 错误信息
}
```

### 批量操作响应
```typescript
{
  success: true,
  data: {
    total: number,      // 总数
    success: number,    // 成功数
    failed: number,     // 失败数
    errors?: string[]   // 错误详情（可选）
  }
}
```

### 分页响应
```typescript
{
  success: true,
  data: {
    items: T[],         // 数据列表
    total: number,      // 总记录数
    page: number,       // 当前页
    limit: number,      // 每页数量
    totalPages: number  // 总页数
  }
}
```

---

## 对比旧设计

### ❌ 旧设计（不够清晰）
```
POST /api/link-pilot/website-profiles
POST /api/link-pilot/website-profile-groups
POST /api/link-pilot/managed-backlinks
POST /api/link-pilot/managed-backlink-groups
```

### ✅ 新设计（语义化、层级化）
```
POST /api/link-pilot/sites
POST /api/link-pilot/sites/groups
POST /api/link-pilot/backlinks
POST /api/link-pilot/backlinks/groups
```

**优势：**
1. 路径更简洁（sites vs website-profiles）
2. 层级更清晰（groups作为子资源）
3. 符合RESTful规范
4. 易于理解和维护
