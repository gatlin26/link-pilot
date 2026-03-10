CREATE TABLE "tool_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tool_submissions_status_idx" ON "tool_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tool_submissions_created_at_idx" ON "tool_submissions" USING btree ("created_at");