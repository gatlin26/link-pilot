ALTER TABLE "tools" ADD COLUMN "status" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "reject_reason" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "submitter_user_id" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "submitter_email" text;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_submitter_user_id_user_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tools_status_idx" ON "tools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tools_submitter_user_id_idx" ON "tools" USING btree ("submitter_user_id");