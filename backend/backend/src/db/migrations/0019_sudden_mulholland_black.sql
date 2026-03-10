-- 添加新字段（先设为可空）
ALTER TABLE "tool_tags" ADD COLUMN "en_name" text;--> statement-breakpoint
ALTER TABLE "tool_tags" ADD COLUMN "zh_name" text;--> statement-breakpoint
ALTER TABLE "tool_tags" ADD COLUMN "en_description" text;--> statement-breakpoint
ALTER TABLE "tool_tags" ADD COLUMN "zh_description" text;--> statement-breakpoint
ALTER TABLE "tool_tags" ADD COLUMN "icon_emoji" text;--> statement-breakpoint
ALTER TABLE "tool_tags" ADD COLUMN "published" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tool_tags" ADD COLUMN "featured" boolean DEFAULT false;--> statement-breakpoint

-- 从现有字段复制数据
UPDATE "tool_tags" SET "en_name" = "name" WHERE "en_name" IS NULL;--> statement-breakpoint
UPDATE "tool_tags" SET "zh_name" = "name" WHERE "zh_name" IS NULL;--> statement-breakpoint
UPDATE "tool_tags" SET "en_description" = "description" WHERE "description" IS NOT NULL;--> statement-breakpoint
UPDATE "tool_tags" SET "zh_description" = "description" WHERE "description" IS NOT NULL;--> statement-breakpoint
UPDATE "tool_tags" SET "icon_emoji" = "icon" WHERE "icon" IS NOT NULL;--> statement-breakpoint

-- 设置 NOT NULL 约束
ALTER TABLE "tool_tags" ALTER COLUMN "en_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_tags" ALTER COLUMN "zh_name" SET NOT NULL;--> statement-breakpoint

-- 创建索引
CREATE INDEX "tool_tags_published_idx" ON "tool_tags" USING btree ("published");--> statement-breakpoint
CREATE INDEX "tool_tags_featured_idx" ON "tool_tags" USING btree ("featured");