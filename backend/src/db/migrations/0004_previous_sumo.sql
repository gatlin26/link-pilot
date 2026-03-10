CREATE TABLE "image_record" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"prompt" text,
	"provider" text,
	"model" text,
	"input_url" text,
	"output_url" text,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_record" ADD CONSTRAINT "image_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_record_user_id_idx" ON "image_record" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "image_record_type_idx" ON "image_record" USING btree ("type");--> statement-breakpoint
CREATE INDEX "image_record_status_idx" ON "image_record" USING btree ("status");--> statement-breakpoint
CREATE INDEX "image_record_created_at_idx" ON "image_record" USING btree ("created_at");