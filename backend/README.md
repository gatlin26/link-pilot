# EditPhoto AI

免费在线 AI 图片编辑器。基于 Next.js 15 构建的现代化图片编辑应用，提供背景移除、图片增强、文本提示编辑等 AI 功能。无需注册即可使用。

## 技术栈

- **框架**: Next.js 15 (App Router)
- **数据库**: PostgreSQL + Drizzle ORM
- **身份验证**: Better Auth (邮箱/密码、Google、GitHub)
- **支付**: Stripe (订阅制 & 一次性支付)
- **UI 组件**: Radix UI + TailwindCSS
- **状态管理**: Zustand
- **国际化**: next-intl (支持中英文)
- **文档系统**: Fumadocs
- **邮件**: React Email + Resend
- **包管理器**: pnpm

## 部署方式

本模板支持两种部署方式:

### 1. 使用 Vercel 部署 (推荐)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

1. 点击上方 "Deploy with Vercel" 按钮
2. 配置环境变量(参考 `.env.example`)
3. 自动完成部署

### 2. 使用 Docker 部署

```bash
# 构建 Docker 镜像
docker build -t saas-template .

# 运行容器
docker run -p 3000:3000 --env-file .env saas-template
```

或使用 Docker Compose:

```bash
docker-compose up -d
```

## 环境要求

- Node.js 18+
- pnpm 8+
- PostgreSQL 数据库
- Stripe 账号 (用于支付)
- Resend 账号 (用于邮件)

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/editphoto-ai/editphoto-ai.git
cd editphoto-ai
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制示例环境变量文件并更新为你的配置:

```bash
cp env.example .env
```

必需的环境变量:
- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `BETTER_AUTH_SECRET`: Better Auth 密钥
- `STRIPE_SECRET_KEY`: Stripe 密钥
- `RESEND_API_KEY`: Resend API 密钥
- 更多配置请查看 `env.example` 文件

### 4. 配置数据库

```bash
# 生成迁移文件
pnpm db:generate

# 执行数据库迁移
pnpm db:migrate

# 或直接推送数据库结构(仅开发环境)
pnpm db:push
```

### 5. 启动开发服务器

```bash
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)

## 开发命令

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm start            # 启动生产服务器

# 数据库
pnpm db:generate      # 生成迁移文件
pnpm db:migrate       # 执行数据库迁移
pnpm db:push          # 推送数据库结构(仅开发)
pnpm db:studio        # 打开 Drizzle Studio

# 代码质量
pnpm lint             # 运行 Biome 代码检查
pnpm format           # 使用 Biome 格式化代码

# 内容和邮件
pnpm content          # 处理 MDX 内容
pnpm email            # 启动邮件模板开发服务器(端口 3333)
```

## 项目结构

```
editphoto-ai/
├── src/
│   ├── app/              # Next.js 应用路由
│   │   ├── [locale]/     # 国际化路由
│   │   └── api/          # API 路由
│   ├── components/       # React 组件
│   │   ├── auth/         # 身份验证组件
│   │   ├── blocks/       # 落地页区块
│   │   ├── dashboard/    # 仪表盘组件
│   │   └── ui/           # UI 组件 (Radix)
│   ├── actions/          # 服务端操作
│   ├── db/               # 数据库结构和迁移
│   ├── lib/              # 工具函数
│   ├── stores/           # Zustand 状态管理
│   ├── hooks/            # 自定义 React Hooks
│   ├── config/           # 配置文件
│   ├── mail/             # 邮件模板
│   ├── payment/          # Stripe 支付集成
│   └── credits/          # 积分系统
├── content/              # MDX 内容(博客、文档)
├── messages/             # 国际化翻译文件
├── public/               # 静态资源
└── scripts/              # 工具脚本
```

## 功能特性

### AI 图片编辑功能
- ✅ 背景移除 - 一键去除图片背景
- ✅ 图片增强 - AI 智能提升图片质量
- ✅ 文本提示编辑 - 用文字描述编辑图片
- ✅ 多种 AI 模型支持 (OpenAI, Replicate, FAL, Google 等)
- ✅ 实时预览和处理进度
- ✅ 免费试用额度

### 技术特性
- ✅ 身份验证(邮箱/密码、Google OAuth)
- ✅ 积分系统(按需付费功能)
- ✅ 多语言支持(中英文)
- ✅ MDX 博客系统
- ✅ 管理员仪表盘
- ✅ 用户管理
- ✅ 邮件模板
- ✅ 新闻订阅集成
- ✅ SEO 优化
- ✅ 深色模式
- ✅ 响应式设计
- ✅ TypeScript 类型安全
- ✅ 内置分析工具支持

## 环境变量

完整的环境变量列表请查看 `env.example` 文件。

关键环境变量:
- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `BETTER_AUTH_URL`: 应用 URL
- `BETTER_AUTH_SECRET`: 身份验证随机密钥
- `STRIPE_SECRET_KEY`: Stripe 密钥
- `STRIPE_WEBHOOK_SECRET`: Stripe Webhook 密钥
- `RESEND_API_KEY`: Resend API 密钥
- `NEXT_PUBLIC_APP_URL`: 公开的应用 URL

## 许可证

详情请查看 [LICENSE](LICENSE) 文件。

## 技术支持

如有问题或需要帮助,请在 GitHub 上提交 Issue。
