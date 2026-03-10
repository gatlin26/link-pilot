-- 重构 tool_tags 表为多语言设计
-- 每个标签每种语言一条记录

-- 1. 创建临时表存储现有数据
CREATE TABLE tool_tags_backup AS SELECT * FROM tool_tags;

-- 2. 删除旧表（包括所有约束和索引）
DROP TABLE IF EXISTS tool_tags CASCADE;

-- 3. 创建新的 tool_tags 表
CREATE TABLE "tool_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text,
	"category" text,
	"color" text,
	"icon_emoji" text,
	"sort_order" integer DEFAULT 0,
	"usage_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"published" boolean DEFAULT true,
	"featured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- 4. 创建索引
CREATE INDEX "tool_tags_slug_locale_idx" ON "tool_tags" ("slug", "locale");
CREATE INDEX "tool_tags_slug_idx" ON "tool_tags" ("slug");
CREATE INDEX "tool_tags_locale_idx" ON "tool_tags" ("locale");
CREATE INDEX "tool_tags_category_idx" ON "tool_tags" ("category");
CREATE INDEX "tool_tags_usage_count_idx" ON "tool_tags" ("usage_count");
CREATE INDEX "tool_tags_published_idx" ON "tool_tags" ("published");
CREATE INDEX "tool_tags_featured_idx" ON "tool_tags" ("featured");

-- 5. 创建唯一约束
CREATE UNIQUE INDEX "tool_tags_slug_locale_unique" ON "tool_tags" ("slug", "locale");

-- 6. 迁移数据：为每个标签创建英文和中文两条记录
-- 插入英文版本（从旧表的 name 字段）
INSERT INTO "tool_tags" (
	id, slug, locale, name, description, category, color, icon_emoji,
	sort_order, usage_count, is_active, published, featured, created_at, updated_at
)
SELECT
	id,
	slug,
	'en' as locale,
	COALESCE(name, slug) as name,
	description,
	category,
	color,
	icon as icon_emoji,
	COALESCE(sort_order, 0) as sort_order,
	COALESCE(usage_count, 0) as usage_count,
	COALESCE(is_active, true) as is_active,
	true as published,
	false as featured,
	COALESCE(created_at, now()) as created_at,
	COALESCE(updated_at, now()) as updated_at
FROM tool_tags_backup;

-- 插入中文版本（生成新的 ID，使用相同的 name）
INSERT INTO "tool_tags" (
	id, slug, locale, name, description, category, color, icon_emoji,
	sort_order, usage_count, is_active, published, featured, created_at, updated_at
)
SELECT
	gen_random_uuid() as id,
	slug,
	'zh' as locale,
	COALESCE(name, slug) as name,
	description,
	category,
	color,
	icon as icon_emoji,
	COALESCE(sort_order, 0) as sort_order,
	COALESCE(usage_count, 0) as usage_count,
	COALESCE(is_active, true) as is_active,
	true as published,
	false as featured,
	COALESCE(created_at, now()) as created_at,
	COALESCE(updated_at, now()) as updated_at
FROM tool_tags_backup;

-- 7. 删除备份表
DROP TABLE tool_tags_backup;
