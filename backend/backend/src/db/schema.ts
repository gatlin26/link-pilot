import { boolean, integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	role: text('role'),
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires'),
	customerId: text('customer_id'),
}, (table) => ({
	userIdIdx: index("user_id_idx").on(table.id),
	userCustomerIdIdx: index("user_customer_id_idx").on(table.customerId),
	userRoleIdx: index("user_role_idx").on(table.role),
}));

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	impersonatedBy: text('impersonated_by')
}, (table) => ({
	sessionTokenIdx: index("session_token_idx").on(table.token),
	sessionUserIdIdx: index("session_user_id_idx").on(table.userId),
}));

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
}, (table) => ({
	accountUserIdIdx: index("account_user_id_idx").on(table.userId),
	accountAccountIdIdx: index("account_account_id_idx").on(table.accountId),
	accountProviderIdIdx: index("account_provider_id_idx").on(table.providerId),
}));

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const payment = pgTable("payment", {
	id: text("id").primaryKey(),
	priceId: text('price_id').notNull(),
	type: text('type').notNull(),
	interval: text('interval'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	customerId: text('customer_id').notNull(),
	subscriptionId: text('subscription_id'),
	sessionId: text('session_id'),
	status: text('status').notNull(),
	periodStart: timestamp('period_start'),
	periodEnd: timestamp('period_end'),
	cancelAtPeriodEnd: boolean('cancel_at_period_end'),
	trialStart: timestamp('trial_start'),
	trialEnd: timestamp('trial_end'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
	paymentTypeIdx: index("payment_type_idx").on(table.type),
	paymentPriceIdIdx: index("payment_price_id_idx").on(table.priceId),
	paymentUserIdIdx: index("payment_user_id_idx").on(table.userId),
	paymentCustomerIdIdx: index("payment_customer_id_idx").on(table.customerId),
	paymentStatusIdx: index("payment_status_idx").on(table.status),
	paymentSubscriptionIdIdx: index("payment_subscription_id_idx").on(table.subscriptionId),
	paymentSessionIdIdx: index("payment_session_id_idx").on(table.sessionId),
}));

export const userCredit = pgTable("user_credit", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	currentCredits: integer("current_credits").notNull().default(0),
	lastRefreshAt: timestamp("last_refresh_at"), // deprecated
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	userCreditUserIdIdx: index("user_credit_user_id_idx").on(table.userId),
}));

export const creditTransaction = pgTable("credit_transaction", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	type: text("type").notNull(),
	description: text("description"),
	amount: integer("amount").notNull(),
	remainingAmount: integer("remaining_amount"),
	paymentId: text("payment_id"),
	expirationDate: timestamp("expiration_date"),
	expirationDateProcessedAt: timestamp("expiration_date_processed_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	creditTransactionUserIdIdx: index("credit_transaction_user_id_idx").on(table.userId),
	creditTransactionTypeIdx: index("credit_transaction_type_idx").on(table.type),
}));

export const imageRecord = pgTable("image_record", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	type: text("type").notNull(), // 'generate' | 'enhance' | 'edit' | 'inpaint' | 'outpaint' | 'upscale'
	status: text("status").notNull(), // 'pending' | 'processing' | 'completed' | 'failed'
	prompt: text("prompt"),
	provider: text("provider"),
	model: text("model"),
	inputUrl: text("input_url"),
	outputUrl: text("output_url"),
	creditsUsed: integer("credits_used").notNull().default(0),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	// EvoLink 异步任务扩展字段
	taskId: text("task_id"), // 三方任务 ID（对外也复用）
	isAsync: boolean("is_async").default(false), // 是否异步任务
	inputImageUrls: text("input_image_urls"), // 输入图 URLs（JSON 数组字符串，图生图/编辑用）
	// 公开可见性
	isPublic: boolean("is_public").default(true), // 是否公开可见（用于 Gallery 展示等）
}, (table) => ({
	imageRecordUserIdIdx: index("image_record_user_id_idx").on(table.userId),
	imageRecordTypeIdx: index("image_record_type_idx").on(table.type),
	imageRecordStatusIdx: index("image_record_status_idx").on(table.status),
	imageRecordCreatedAtIdx: index("image_record_created_at_idx").on(table.createdAt),
	imageRecordTaskIdIdx: index("image_record_task_id_idx").on(table.taskId),
}));

/**
 * 全局免费池每日统计表
 * 所有匿名用户共享每日 100 Credits 的免费额度
 */
export const freePoolDaily = pgTable("free_pool_daily", {
	id: text("id").primaryKey(),
	date: text("date").notNull().unique(), // 格式: YYYY-MM-DD
	usedCredits: integer("used_credits").notNull().default(0),
	maxCredits: integer("max_credits").notNull().default(100),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	freePoolDateIdx: index("free_pool_date_idx").on(table.date),
}));

/**
 * 匿名用户每日使用记录表
 * 记录每个匿名用户（通过 IP 或设备指纹识别）的每日使用量
 */
export const anonymousUsageDaily = pgTable("anonymous_usage_daily", {
	id: text("id").primaryKey(),
	date: text("date").notNull(), // 格式: YYYY-MM-DD
	identifier: text("identifier").notNull(), // IP 地址或设备指纹
	identifierType: text("identifier_type").notNull().default("ip"), // 'ip' | 'fingerprint'
	usedCredits: integer("used_credits").notNull().default(0),
	generationCount: integer("generation_count").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	anonymousUsageDateIdx: index("anonymous_usage_date_idx").on(table.date),
	anonymousUsageIdentifierIdx: index("anonymous_usage_identifier_idx").on(table.identifier),
	anonymousUsageDateIdentifierIdx: index("anonymous_usage_date_identifier_idx").on(table.date, table.identifier),
}));

/**
 * 工具提交表
 * 存储用户提交的工具信息，用于审核和收录
 */
export const toolSubmissions = pgTable("tool_submissions", {
	id: text("id").primaryKey(),
	userId: text("user_id").references(() => user.id, { onDelete: 'cascade' }), // 提交用户ID
	name: text("name").notNull(),
	url: text("url").notNull(),
	category: text("category"), // 已移除，设为可选
	description: text("description"),
	email: text("email").notNull(),
	iconUrl: text("icon_url"),                       // Logo URL
	thumbnailUrl: text("thumbnail_url"),             // 缩略图 URL
	imageUrl: text("image_url"),                     // 截图 URL
	status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
	rejectReason: text("reject_reason"), // 拒绝原因
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	toolSubmissionsStatusIdx: index("tool_submissions_status_idx").on(table.status),
	toolSubmissionsCreatedAtIdx: index("tool_submissions_created_at_idx").on(table.createdAt),
	toolSubmissionsUserIdIdx: index("tool_submissions_user_id_idx").on(table.userId),
}));

/**
 * 工具主表 - 存储语言无关的基础信息
 * 统一管理工具提交和发布状态
 */
export const tools = pgTable("tools", {
	id: text("id").primaryKey(),
	slug: text("slug").notNull().unique(),           // URL slug (如 buildway-cc)
	name: text("name").notNull(),                    // 工具名称
	url: text("url").notNull(),                      // 工具官网
	tags: text("tags"),                              // JSON 数组 ["AI Tool", "Image Generation", "Freemium", "Web App"]
	dr: integer("dr"),                               // Domain Rating (0-100)
	mv: text("mv"),                                  // Monthly Visitors (如 "0.1", "10")
	iconUrl: text("icon_url"),                       // 图标 URL
	imageUrl: text("image_url"),                     // 截图 URL
	thumbnailUrl: text("thumbnail_url"),             // 缩略图 URL
	screenshots: text("screenshots"),                // 多张截图 JSON 数组 ["url1", "url2", ...]
	starRating: integer("star_rating").default(5),
	avgRating: text("avg_rating"),                  // 用户评分均值（如 "4.5"），由评论系统自动更新
	reviewCount: integer("review_count").default(0), // 评论总数，由评论系统自动更新
	featured: boolean("featured").default(false),
	published: boolean("published").default(true),
	// 审核相关字段
	status: text("status").notNull().default("published"), // 'unpaid' | 'pending' | 'rejected' | 'published'
	rejectReason: text("reject_reason"),             // 拒绝原因
	submitterUserId: text("submitter_user_id").references(() => user.id, { onDelete: 'set null' }), // 提交者用户ID
	submitterEmail: text("submitter_email"),         // 提交者邮箱
	// 旧字段（保留兼容）
	submissionId: text("submission_id").references(() => toolSubmissions.id),
	collectionTime: timestamp("collection_time"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	toolsSlugIdx: index("tools_slug_idx").on(table.slug),
	toolsPublishedIdx: index("tools_published_idx").on(table.published),
	toolsFeaturedIdx: index("tools_featured_idx").on(table.featured),
	toolsCreatedAtIdx: index("tools_created_at_idx").on(table.createdAt),
	toolsStatusIdx: index("tools_status_idx").on(table.status),
	toolsSubmitterUserIdIdx: index("tools_submitter_user_id_idx").on(table.submitterUserId),
}));

/**
 * 工具翻译表 - 存储多语言内容
 * 每个工具每种语言一条记录
 */
export const toolTranslations = pgTable("tool_translations", {
	id: text("id").primaryKey(),
	toolId: text("tool_id").notNull().references(() => tools.id, { onDelete: 'cascade' }),
	locale: text("locale").notNull(),                // 语言代码: 'en' | 'zh'
	title: text("title").notNull(),                  // SEO 标题
	description: text("description"),                // 简短描述 (用于列表和 SEO)
	introduction: text("introduction"),              // Markdown 详细介绍
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	toolTranslationsToolIdLocaleIdx: index("tool_translations_tool_id_locale_idx").on(table.toolId, table.locale),
	toolTranslationsToolIdIdx: index("tool_translations_tool_id_idx").on(table.toolId),
	toolTranslationsLocaleIdx: index("tool_translations_locale_idx").on(table.locale),
}));

/**
 * 工具参考信息表 - 存储从 URL 抓取的参考内容
 * 用于 AI 分析和内容生成
 */
export const toolReferences = pgTable("tool_references", {
	id: text("id").primaryKey(),
	toolId: text("tool_id").references(() => tools.id, { onDelete: 'cascade' }),
	submissionId: text("submission_id").references(() => toolSubmissions.id, { onDelete: 'cascade' }),
	url: text("url").notNull(),                      // 抓取的 URL
	source: text("source").notNull(),                // 'auto' | 'manual'
	status: text("status").notNull(),                // 'success' | 'partial' | 'failed'

	// 抓取的原始内容
	rawTitle: text("raw_title"),                     // 网页标题
	rawDescription: text("raw_description"),         // Meta 描述
	rawContent: text("raw_content"),                 // 主要内容（限制10000字符）
	fetchError: text("fetch_error"),                 // 抓取失败原因

	// 手动补充内容
	manualNotes: text("manual_notes"),               // 管理员手动添加的备注
	manualContent: text("manual_content"),           // 手动输入的参考内容

	fetchedAt: timestamp("fetched_at"),              // 抓取时间
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	toolReferencesToolIdIdx: index("tool_references_tool_id_idx").on(table.toolId),
	toolReferencesSubmissionIdIdx: index("tool_references_submission_id_idx").on(table.submissionId),
	toolReferencesUrlIdx: index("tool_references_url_idx").on(table.url),
}));

/**
 * 工具标签主表 - 存储语言无关的标签属性
 */
export const toolTags = pgTable("tool_tags", {
	id: text("id").primaryKey(),
	slug: text("slug").notNull().unique(),           // 标签唯一标识
	category: text("category"),                      // 标签分类 (如 "type", "pricing", "platform")
	status: text("status").default('draft'),         // 状态: draft | published | archived
	sortOrder: integer("sort_order").default(0),     // 排序顺序
	usageCount: integer("usage_count").default(0),   // 使用次数（冗余字段，便于排序）
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	toolTagsSlugIdx: index("tool_tags_slug_idx").on(table.slug),
	toolTagsCategoryIdx: index("tool_tags_category_idx").on(table.category),
	toolTagsStatusIdx: index("tool_tags_status_idx").on(table.status),
	toolTagsUsageCountIdx: index("tool_tags_usage_count_idx").on(table.usageCount),
	toolTagsSortOrderIdx: index("tool_tags_sort_order_idx").on(table.sortOrder),
}));

/**
 * 工具标签翻译表 - 存储多语言内容
 */
export const toolTagTranslations = pgTable("tool_tag_translations", {
	id: text("id").primaryKey(),
	slug: text("slug").notNull().references(() => toolTags.slug, { onDelete: 'cascade' }),
	locale: text("locale").notNull(),                // 语言代码: 'en' | 'zh'
	name: text("name").notNull(),                    // 标签名称（本地化）
	description: text("description"),                // 标签描述（本地化）
	content: text("content"),                        // 详细内容（Markdown 格式，本地化）
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	toolTagTranslationsSlugIdx: index("tool_tag_translations_slug_idx").on(table.slug),
	toolTagTranslationsLocaleIdx: index("tool_tag_translations_locale_idx").on(table.locale),
	toolTagTranslationsSlugLocaleIdx: index("tool_tag_translations_slug_locale_idx").on(table.slug, table.locale),
}));

/**
 * 工具评论表 - 用户对工具的评分和评论
 * 同一用户对同一工具可重复提交多条评论
 */
export const toolReviews = pgTable("tool_reviews", {
	id: text("id").primaryKey(),
	toolId: text("tool_id").notNull().references(() => tools.id, { onDelete: 'cascade' }),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	rating: integer("rating").notNull(),             // 1-5 星评分
	comment: text("comment"),                         // 评论内容（可选）
	status: text("status").notNull().default("published"), // 'published' | 'hidden'
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	deletedAt: timestamp("deleted_at"),              // 软删除标记
}, (table) => ({
	toolReviewsToolIdIdx: index("tool_reviews_tool_id_idx").on(table.toolId),
	toolReviewsUserIdIdx: index("tool_reviews_user_id_idx").on(table.userId),
	toolReviewsToolUserIdx: index("tool_reviews_tool_user_idx").on(table.toolId, table.userId),
	toolReviewsStatusIdx: index("tool_reviews_status_idx").on(table.status),
	toolReviewsCreatedAtIdx: index("tool_reviews_created_at_idx").on(table.createdAt),
	toolReviewsDeletedAtIdx: index("tool_reviews_deleted_at_idx").on(table.deletedAt),
}));

// TypeScript 类型
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type ToolTranslation = typeof toolTranslations.$inferSelect;
export type NewToolTranslation = typeof toolTranslations.$inferInsert;
export type ToolReference = typeof toolReferences.$inferSelect;
export type NewToolReference = typeof toolReferences.$inferInsert;
export type ToolTag = typeof toolTags.$inferSelect;
export type NewToolTag = typeof toolTags.$inferInsert;
export type ToolTagTranslation = typeof toolTagTranslations.$inferSelect;
export type NewToolTagTranslation = typeof toolTagTranslations.$inferInsert;
export type ToolReview = typeof toolReviews.$inferSelect;
export type NewToolReview = typeof toolReviews.$inferInsert;
