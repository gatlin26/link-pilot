CREATE TABLE "tool_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"introduction" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"categories" text,
	"tags" text,
	"dr" integer,
	"mv" text,
	"icon_url" text,
	"image_url" text,
	"thumbnail_url" text,
	"star_rating" integer DEFAULT 5,
	"featured" boolean DEFAULT false,
	"published" boolean DEFAULT true,
	"submission_id" text,
	"collection_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "tool_submissions" ADD COLUMN "reject_reason" text;--> statement-breakpoint
ALTER TABLE "tool_translations" ADD CONSTRAINT "tool_translations_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_submission_id_tool_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."tool_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_translations_tool_id_locale_idx" ON "tool_translations" USING btree ("tool_id","locale");--> statement-breakpoint
CREATE INDEX "tool_translations_tool_id_idx" ON "tool_translations" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_translations_locale_idx" ON "tool_translations" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "tools_slug_idx" ON "tools" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tools_published_idx" ON "tools" USING btree ("published");--> statement-breakpoint
CREATE INDEX "tools_featured_idx" ON "tools" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "tools_created_at_idx" ON "tools" USING btree ("created_at");