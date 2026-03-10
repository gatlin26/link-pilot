# Link Pilot 数据表设计方案

## 一、核心数据表（必需）

### 1. backlinks - 外链表 ✅ 已实现
**用途：** 存储从Ahrefs等平台采集的外链数据

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  sourcePlatform: string // 'ahrefs'
  collectionBatchId: string
  backlinkGroupId: string (nullable)
  collectedAt: timestamp
  targetDomain: string
  targetUrl: string
  referringPageUrl: string
  referringDomain: string
  anchorText: string
  pageTitle: string
  rawMetrics: text (JSON) // DR, traffic等指标
  rawSnapshot: text (限制5KB)
  siteSummary: text (nullable)
  linkType: string (nullable) // 'blog_comment', 'guest_post'等
  siteBusinessTypes: text (JSON array, nullable)
  contextMatchScore: integer (nullable)
  contextMatchNote: text (nullable)
  status: string // 'collected', 'synced', 'reviewed'等
  notes: text (nullable)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, status, collectedAt, targetDomain, collectionBatchId

---

### 2. opportunities - 机会表 ✅ 已实现
**用途：** 存储可提交的外链机会

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  backlinkId: string (FK -> backlinks.id)
  url: string
  domain: string
  pageType: string // 'blog_post', 'forum_thread'等
  pathPattern: string
  linkType: string
  siteSummary: string
  siteBusinessTypes: text (JSON array)
  contextMatchScore: integer
  contextMatchNote: text
  canSubmit: boolean
  canAutoFill: boolean
  canAutoSubmit: boolean
  status: string // 'new', 'ready_to_submit', 'submitted'等
  notes: text (nullable)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, status, backlinkId, domain

---

### 3. siteTemplates - 站点模板表 ✅ 已实现
**用途：** 存储表单字段映射配置（自动学习）

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  domain: string
  pageType: string
  pathPattern: string
  fieldMappings: text (JSON) // [{field_type, selector, required, default_value}]
  submitSelector: string
  version: integer
  learningSource: string (nullable) // 'auto', 'user_assisted'
  usageCount: integer (default 0)
  successCount: integer (default 0)
  lastUsedAt: timestamp (nullable)
  confidenceScore: float (nullable)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, domain, pageType

**需要添加的字段：**
- learningSource
- usageCount
- successCount
- lastUsedAt
- confidenceScore

---

### 4. submissions - 提交记录表 ✅ 已实现
**用途：** 存储提交历史记录

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  opportunityId: string (FK -> opportunities.id)
  domain: string
  pageUrl: string
  submitMode: string // 'manual', 'auto'
  didClickSubmit: boolean
  result: string // 'success', 'failed', 'unknown'
  commentExcerpt: string
  errorMessage: text (nullable)
  createdAt: timestamp
}
```

**索引：**
- userId, opportunityId, result, createdAt

---

## 二、用户配置表（必需）

### 5. websiteProfiles - 网站资料表 ⚠️ 需要新建
**用途：** 存储用户的网站信息（用于自动填充）

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  groupId: string (FK -> websiteProfileGroups.id)
  name: string // 网站名称
  url: string // 网站URL
  domain: string
  email: string // 联系邮箱
  comments: text (JSON array) // 预设评论模板
  enabled: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, groupId, enabled

**API接口：**
- `POST /api/link-pilot/website-profiles` - 批量同步
- `GET /api/link-pilot/website-profiles` - 获取列表
- `PUT /api/link-pilot/website-profiles/:id` - 更新
- `DELETE /api/link-pilot/website-profiles/:id` - 删除

---

### 6. websiteProfileGroups - 网站分组表 ⚠️ 需要新建
**用途：** 网站资料分组管理

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  name: string
  websiteCount: integer (default 0)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId

**API接口：**
- `POST /api/link-pilot/website-profile-groups` - 创建分组
- `GET /api/link-pilot/website-profile-groups` - 获取列表
- `PUT /api/link-pilot/website-profile-groups/:id` - 更新
- `DELETE /api/link-pilot/website-profile-groups/:id` - 删除

---

### 7. managedBacklinks - 管理外链表 ⚠️ 需要新建
**用途：** 用户手动管理的外链列表（MVP功能）

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  groupId: string (FK -> managedBacklinkGroups.id)
  url: string
  domain: string
  note: text (nullable)
  keywords: text (JSON array)
  dr: integer (nullable) // Domain Rating
  as: integer (nullable) // Authority Score
  flagged: boolean (default false)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, groupId, domain

**API接口：**
- `POST /api/link-pilot/managed-backlinks` - 批量同步
- `GET /api/link-pilot/managed-backlinks` - 获取列表
- `PUT /api/link-pilot/managed-backlinks/:id` - 更新
- `DELETE /api/link-pilot/managed-backlinks/:id` - 删除

---

### 8. managedBacklinkGroups - 外链分组表 ⚠️ 需要新建
**用途：** 外链分组管理

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  name: string
  backlinkCount: integer (default 0)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId

**API接口：**
- `POST /api/link-pilot/managed-backlink-groups` - 创建分组
- `GET /api/link-pilot/managed-backlink-groups` - 获取列表
- `PUT /api/link-pilot/managed-backlink-groups/:id` - 更新
- `DELETE /api/link-pilot/managed-backlink-groups/:id` - 删除

---

## 三、辅助数据表（可选）

### 9. collectionBatches - 收集批次表 ⚠️ 需要新建
**用途：** 记录每次采集的批次信息

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  sourcePlatform: string
  count: integer
  collectedAt: timestamp
  syncStatus: string // 'pending', 'syncing', 'synced', 'failed'
  syncedCount: integer (default 0)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, sourcePlatform, collectedAt

**API接口：**
- `POST /api/link-pilot/collection-batches` - 创建批次
- `GET /api/link-pilot/collection-batches` - 获取列表

---

### 10. syncJobs - 同步任务表 ⚠️ 需要新建
**用途：** 记录数据同步任务（用于重试机制）

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  entityType: string // 'backlink', 'opportunity', 'template', 'submission'
  entityId: string
  operation: string // 'create', 'update'
  status: string // 'pending', 'success', 'failed'
  retryCount: integer (default 0)
  errorMessage: text (nullable)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**索引：**
- userId, status, entityType

**API接口：**
- `GET /api/link-pilot/sync-jobs` - 获取同步状态
- `POST /api/link-pilot/sync-jobs/retry` - 重试失败任务

---

### 11. recursiveCollectionSessions - 递归采集会话表 ⚠️ 需要新建
**用途：** 记录递归采集任务（高级功能）

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  initialUrl: string
  strategy: string // 'depth_first', 'breadth_first'
  maxDepth: integer
  maxLinksPerUrl: integer
  status: string // 'initialized', 'running', 'paused', 'completed'
  config: text (JSON)
  stats: text (JSON)
  createdAt: timestamp
  updatedAt: timestamp
  startedAt: timestamp (nullable)
  pausedAt: timestamp (nullable)
  completedAt: timestamp (nullable)
}
```

**索引：**
- userId, status

**API接口：**
- `POST /api/link-pilot/recursive-sessions` - 创建会话
- `GET /api/link-pilot/recursive-sessions/:id` - 获取状态
- `PUT /api/link-pilot/recursive-sessions/:id/pause` - 暂停
- `PUT /api/link-pilot/recursive-sessions/:id/resume` - 恢复

---

### 12. recursiveQueueItems - 递归队列表 ⚠️ 需要新建
**用途：** 递归采集的URL队列

**字段：**
```typescript
{
  id: string (PK)
  userId: string (FK -> user.id)
  sessionId: string (FK -> recursiveCollectionSessions.id)
  url: string
  domain: string
  depth: integer
  parentId: string (nullable)
  status: string // 'pending', 'in_progress', 'completed', 'failed', 'skipped'
  collectedCount: integer (nullable)
  retryCount: integer (default 0)
  errorMessage: text (nullable)
  createdAt: timestamp
  updatedAt: timestamp
  startedAt: timestamp (nullable)
  completedAt: timestamp (nullable)
}
```

**索引：**
- userId, sessionId, status, depth

---

## 四、数据表优先级

### 🔴 P0 - 立即实现（核心功能）
1. ✅ backlinks
2. ✅ opportunities
3. ✅ siteTemplates（需要添加学习相关字段）
4. ✅ submissions
5. ⚠️ websiteProfiles
6. ⚠️ websiteProfileGroups
7. ⚠️ managedBacklinks
8. ⚠️ managedBacklinkGroups

### 🟡 P1 - 第二阶段（增强功能）
9. collectionBatches
10. syncJobs

### 🟢 P2 - 第三阶段（高级功能）
11. recursiveCollectionSessions
12. recursiveQueueItems

---

## 五、需要实现的API接口

### 已实现 ✅
1. `POST /api/link-pilot/ping` - 健康检查
2. `POST /api/link-pilot/backlinks` - 批量同步外链
3. `POST /api/link-pilot/opportunities` - 批量同步机会
4. `POST /api/link-pilot/templates` - 批量同步模板
5. `POST /api/link-pilot/submissions` - 批量同步提交记录
6. `POST /api/link-pilot/generate-comment` - AI生成评论

### 需要新增 ⚠️

#### 网站资料管理
7. `POST /api/link-pilot/website-profiles` - 批量同步网站资料
8. `GET /api/link-pilot/website-profiles` - 获取网站资料列表
9. `PUT /api/link-pilot/website-profiles/:id` - 更新网站资料
10. `DELETE /api/link-pilot/website-profiles/:id` - 删除网站资料

#### 网站分组管理
11. `POST /api/link-pilot/website-profile-groups` - 创建分组
12. `GET /api/link-pilot/website-profile-groups` - 获取分组列表
13. `PUT /api/link-pilot/website-profile-groups/:id` - 更新分组
14. `DELETE /api/link-pilot/website-profile-groups/:id` - 删除分组

#### 管理外链
15. `POST /api/link-pilot/managed-backlinks` - 批量同步管理外链
16. `GET /api/link-pilot/managed-backlinks` - 获取管理外链列表
17. `PUT /api/link-pilot/managed-backlinks/:id` - 更新管理外链
18. `DELETE /api/link-pilot/managed-backlinks/:id` - 删除管理外链

#### 外链分组
19. `POST /api/link-pilot/managed-backlink-groups` - 创建外链分组
20. `GET /api/link-pilot/managed-backlink-groups` - 获取外链分组列表
21. `PUT /api/link-pilot/managed-backlink-groups/:id` - 更新外链分组
22. `DELETE /api/link-pilot/managed-backlink-groups/:id` - 删除外链分组

#### 数据查询（可选）
23. `GET /api/link-pilot/backlinks` - 查询外链列表（分页、筛选）
24. `GET /api/link-pilot/opportunities` - 查询机会列表
25. `GET /api/link-pilot/submissions` - 查询提交记录
26. `GET /api/link-pilot/stats` - 获取统计数据

---

## 六、数据同步策略

### 同步方向
```
扩展 → 后台：批量同步（POST）
后台 → 扩展：按需查询（GET）
```

### 同步时机
1. **外链采集后** → 立即同步backlinks
2. **机会识别后** → 立即同步opportunities
3. **表单提交后** → 立即同步submissions
4. **模板学习后** → 立即同步siteTemplates
5. **用户配置变更** → 立即同步websiteProfiles/managedBacklinks

### 冲突处理
- 使用`upsert`策略（INSERT ... ON CONFLICT DO UPDATE）
- 以扩展端数据为准（后台不主动修改）
- 保留updatedAt字段用于版本控制

---

## 七、下一步行动

### 立即执行（P0）
1. ✅ 更新siteTemplates表，添加学习相关字段
2. ⚠️ 创建websiteProfiles表和API
3. ⚠️ 创建websiteProfileGroups表和API
4. ⚠️ 创建managedBacklinks表和API
5. ⚠️ 创建managedBacklinkGroups表和API

### 第二阶段（P1）
6. 创建collectionBatches表和API
7. 创建syncJobs表和API
8. 实现数据查询接口（GET）
9. 实现统计接口

### 第三阶段（P2）
10. 创建递归采集相关表和API
11. 实现高级筛选和搜索
12. 实现数据导出功能

---

## 八、技术要点

### 数据库设计
- 所有表都包含userId字段（多租户隔离）
- 使用text类型存储JSON（PostgreSQL原生支持）
- 合理使用索引（避免过度索引）
- 外键约束使用CASCADE删除

### API设计
- 统一的响应格式
- Better Auth认证
- Zod参数验证
- 批量操作支持
- 错误处理和重试机制

### 性能优化
- 批量插入（减少数据库往返）
- 索引优化（查询性能）
- 分页查询（大数据量）
- 缓存策略（热点数据）
