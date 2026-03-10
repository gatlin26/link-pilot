CREATE TABLE "tool_references" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_id" text,
	"submission_id" text,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"raw_title" text,
	"raw_description" text,
	"raw_content" text,
	"fetch_error" text,
	"manual_notes" text,
	"manual_content" text,
	"fetched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "types" text;--> statement-breakpoint
ALTER TABLE "tool_references" ADD CONSTRAINT "tool_references_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_references" ADD CONSTRAINT "tool_references_submission_id_tool_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."tool_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_references_tool_id_idx" ON "tool_references" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_references_submission_id_idx" ON "tool_references" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "tool_references_url_idx" ON "tool_references" USING btree ("url");