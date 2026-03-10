# 管理员管理脚本

## 📝 可用脚本

### 1. 设置管理员
将指定用户设置为管理员：
```bash
pnpm tsx scripts/set-admin.ts <user-email>
```

**示例：**
```bash
pnpm tsx scripts/set-admin.ts admin@example.com
```

**输出示例：**
```
🔍 查找用户: admin@example.com

📋 用户信息:
  ID: abc123
  Name: Admin User
  Email: admin@example.com
  Current Role: (无)

🔧 设置为管理员...
✅ 成功！用户已设置为管理员

💡 提示：
  - 用户需要重新登录才能获得管理员权限
  - 管理员可以访问 /admin/users 管理页面
```

---

### 2. 列出所有管理员
查看当前系统中的所有管理员：
```bash
pnpm tsx scripts/list-admins.ts
```

**输出示例：**
```
🔍 查询所有管理员...

📋 管理员列表 (2):

1. Admin User
   Email: admin@example.com
   ID: abc123
   Created: 2025-12-22T10:00:00.000Z

2. Super Admin
   Email: super@example.com
   ID: def456
   Created: 2025-12-20T15:30:00.000Z
```

---

### 3. 移除管理员权限
移除指定用户的管理员权限：
```bash
pnpm tsx scripts/remove-admin.ts <user-email>
```

**示例：**
```bash
pnpm tsx scripts/remove-admin.ts admin@example.com
```

---

## 🔐 管理员权限说明

### 管理员可以做什么？

1. **访问管理后台**
   - URL: `/admin/users`
   - 查看所有用户列表
   - 管理用户状态（封禁/解封）

2. **使用管理员专属 API**
   - 通过 `adminActionClient` 保护的所有操作
   - 参见：`src/lib/safe-action.ts`

### 权限检查逻辑

在代码中，管理员检查如下：
```typescript
// src/lib/safe-action.ts
export const adminActionClient = userActionClient.use(async ({ next, ctx }) => {
  const user = (ctx as { user: User }).user;
  const isAdmin = user.role === 'admin';

  if (!isAdmin) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  return next({ ctx });
});
```

---

## 📊 数据库结构说明

### User 表
```typescript
user {
  id: string
  email: string
  name: string
  role: string | null  // 'admin' 表示管理员
  // ... 其他字段
}
```

### Account 表
```typescript
account {
  id: string
  userId: string       // 关联到 user.id
  providerId: string   // 'google', 'github', 'credential'
  // ... 其他字段
}
```

### 关系说明
- **一个 User 可以有多个 Account**（多种登录方式）
- **一个 Account 只能属于一个 User**
- 关系：`Account : User = N : 1`

**示例：**
```
User: admin@example.com
  ├── Account 1: Google 登录
  ├── Account 2: GitHub 登录
  └── Account 3: 邮箱密码登录
```

---

## ⚠️ 注意事项

1. **重新登录**
   - 设置/移除管理员权限后，用户需要重新登录才能生效

2. **数据库连接**
   - 确保 `.env.local` 中配置了正确的 `DATABASE_URL`

3. **安全性**
   - 妥善保管管理员账号
   - 定期审查管理员列表
   - 及时移除不需要的管理员权限

---

## 🛠️ 故障排查

### 脚本运行失败？

1. **检查数据库连接**
   ```bash
   echo $DATABASE_URL
   ```

2. **确保依赖已安装**
   ```bash
   pnpm install
   ```

3. **检查用户是否存在**
   ```bash
   pnpm tsx scripts/list-admins.ts
   ```

### 管理员权限不生效？

1. **确认用户已重新登录**
2. **检查数据库中的 role 字段**
3. **清除浏览器缓存和 cookies**

---

## 📚 相关文件

- **权限检查**: `src/lib/safe-action.ts`
- **数据库 Schema**: `src/db/schema.ts`
- **管理员页面**: `src/app/[locale]/(protected)/admin/users/page.tsx`
