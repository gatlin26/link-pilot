# Link Pilot V1.0 数据表设计（精简版）

## 核心目标
**第一版本专注于外链管理功能**，其他功能暂不实现。

---

## 必需数据表（仅4张）

### 1. managedBacklinks - 管理外链表 🔴 核心
**用途：** 用户手动管理的外链列表（MVP核心功能）

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  groupId: string (FK -> managedBacklinkGroups.id)
  url: string
  domain: string
  note: text (nullable)
  keywords: text (JSON array) // ['SEO', 'AI Tools']
  dr: integer (nullable) // Domain Rating
  as: integer (nullable) // Authority Score
  flagged: boolean (default false) // 标记重要
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, groupId, domain, flagged

---

### 2. managedBacklinkGroups - 外链分组表 🔴 核心
**用途：** 外链分组管理

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  name: string // '高质量外链', 'AI工具站点'
  backlinkCount: integer (default 0) // 冗余字段，方便显示
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId

---

### 3. websiteProfiles - 网站资料表 🔴 核心
**用途：** 用户的网站信息（用于自动填充评论）

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  groupId: string (FK -> websiteProfileGroups.id)
  name: string // '我的AI工具'
  url: string // 'https://myaitool.com'
  domain: string // 'myaitool.com'
  email: string // 'contact@myaitool.com'
  comments: text (JSON array) // ['Great article!', 'Thanks for sharing!']
  enabled: boolean (default true)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, groupId, enabled

---

### 4. websiteProfileGroups - 网站分组表 🔴 核心
**用途：** 网站资料分组

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  name: string // 'SaaS产品', 'AI工具'
  websiteCount: integer (default 0)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId

---

## 必需API接口（8个）

### 管理外链 API
1. **POST /api/link-pilot/managed-backlinks**
   - 批量同步管理外链
   - 请求体：`{ backlinks: ManagedBacklink[] }`
   - 响应：`{ success, data: { total, success, failed } }`

2. **GET /api/link-pilot/managed-backlinks**
   - 获取外链列表（支持分页、筛选）
   - 查询参数：`?groupId=xxx&flagged=true&page=1&limit=50`
   - 响应：`{ success, data: { items, total, page, limit } }`

3. **PUT /api/link-pilot/managed-backlinks/:id**
   - 更新单个外链
   - 请求体：`{ note?, keywords?, dr?, as?, flagged? }`

4. **DELETE /api/link-pilot/managed-backlinks/:id**
   - 删除单个外链

### 外链分组 API
5. **POST /api/link-pilot/managed-backlink-groups**
   - 创建分组
   - 请求体：`{ name: string }`

6. **GET /api/link-pilot/managed-backlink-groups**
   - 获取分组列表
   - 响应：`{ success, data: ManagedBacklinkGroup[] }`

7. **PUT /api/link-pilot/managed-backlink-groups/:id**
   - 更新分组名称
   - 请求体：`{ name: string }`

8. **DELETE /api/link-pilot/managed-backlink-groups/:id**
   - 删除分组（需要先删除或移动分组内的外链）

### 网站资料 API
9. **POST /api/link-pilot/website-profiles**
   - 批量同步网站资料
   - 请求体：`{ profiles: WebsiteProfile[] }`

10. **GET /api/link-pilot/website-profiles**
    - 获取网站资料列表
    - 查询参数：`?groupId=xxx&enabled=true`

11. **PUT /api/link-pilot/website-profiles/:id**
    - 更新网站资料

12. **DELETE /api/link-pilot/website-profiles/:id**
    - 删除网站资料

### 网站分组 API
13. **POST /api/link-pilot/website-profile-groups**
    - 创建分组

14. **GET /api/link-pilot/website-profile-groups**
    - 获取分组列表

15. **PUT /api/link-pilot/website-profile-groups/:id**
    - 更新分组

16. **DELETE /api/link-pilot/website-profile-groups/:id**
    - 删除分组

---

## 用户使用流程

### 1. 初始化设置
```
用户 → 创建网站分组 → 添加网站资料 → 设置评论模板
```

### 2. 外链管理
```
用户 → 创建外链分组 → 添加外链 → 标记/备注/分类
```

### 3. 提交评论
```
扩展 → 读取外链列表 → 打开外链页面 → 自动填充（网站信息+评论）
```

---

## 数据流向

```
┌─────────────────┐
│  浏览器扩展      │
│  (前端存储)      │
└────────┬────────┘
         │ 同步
         ↓
┌─────────────────┐
│  后台API        │
│  (Next.js)      │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  PostgreSQL     │
│  (4张表)        │
└─────────────────┘
```

---

## V1.0 不包含的功能（后续版本）

❌ Ahrefs采集的外链数据（backlinks表）
❌ 机会识别（opportunities表）
❌ 表单模板学习（siteTemplates表）
❌ 提交记录（submissions表）
❌ AI评论生成（generate-comment接口）
❌ 递归采集
❌ 同步任务队列

---

## 实施步骤

### Step 1: 创建数据表
```sql
-- 1. managedBacklinkGroups
-- 2. managedBacklinks
-- 3. websiteProfileGroups
-- 4. websiteProfiles
```

### Step 2: 实现API接口
```
1. 外链CRUD (4个接口)
2. 外链分组CRUD (4个接口)
3. 网站资料CRUD (4个接口)
4. 网站分组CRUD (4个接口)
```

### Step 3: 前端集成
```
1. 修改存储层，连接后台API
2. 实现数据同步逻辑
3. 测试完整流程
```

---

## 技术要点

### 数据同步策略
- **双向同步**：扩展 ↔ 后台
- **冲突解决**：以最新的updatedAt为准
- **离线支持**：扩展本地存储优先，联网后同步

### API设计原则
- 统一响应格式
- Better Auth认证
- 批量操作支持
- 分页查询
- 错误处理

### 性能优化
- 索引优化
- 批量插入
- 分页加载
- 缓存策略

---

## 总结

**V1.0 = 外链管理 + 网站资料管理**

- ✅ 4张数据表
- ✅ 16个API接口
- ✅ 简单清晰的数据流
- ✅ 专注核心功能
- ✅ 易于扩展

后续版本再逐步添加：
- V2.0: Ahrefs采集 + 机会识别
- V3.0: 表单学习 + 提交记录
- V4.0: AI评论生成
- V5.0: 递归采集
