ALTER TABLE "tool_submissions" ADD COLUMN "icon_url" text;--> statement-breakpoint
ALTER TABLE "tool_submissions" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "tool_submissions" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "tools" DROP COLUMN "reference_content";