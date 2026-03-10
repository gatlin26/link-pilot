ALTER TABLE "tool_submissions" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "tool_submissions" ADD CONSTRAINT "tool_submissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_submissions_user_id_idx" ON "tool_submissions" USING btree ("user_id");