CREATE TABLE "tool_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"color" text,
	"icon" text,
	"sort_order" integer DEFAULT 0,
	"usage_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tool_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tool_to_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_to_tags" ADD CONSTRAINT "tool_to_tags_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_to_tags" ADD CONSTRAINT "tool_to_tags_tag_id_tool_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tool_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_tags_slug_idx" ON "tool_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tool_tags_category_idx" ON "tool_tags" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tool_tags_usage_count_idx" ON "tool_tags" USING btree ("usage_count");--> statement-breakpoint
CREATE INDEX "tool_tags_is_active_idx" ON "tool_tags" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "tool_to_tags_tool_id_idx" ON "tool_to_tags" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_to_tags_tag_id_idx" ON "tool_to_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tool_to_tags_tool_id_tag_id_idx" ON "tool_to_tags" USING btree ("tool_id","tag_id");