ALTER TABLE "image_record" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "image_record" ADD COLUMN "is_async" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "image_record" ADD COLUMN "input_image_urls" text;--> statement-breakpoint
CREATE INDEX "image_record_task_id_idx" ON "image_record" USING btree ("task_id");