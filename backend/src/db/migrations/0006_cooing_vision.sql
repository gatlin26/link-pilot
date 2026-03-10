CREATE TABLE "anonymous_usage_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"identifier" text NOT NULL,
	"identifier_type" text DEFAULT 'ip' NOT NULL,
	"used_credits" integer DEFAULT 0 NOT NULL,
	"generation_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "free_pool_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"used_credits" integer DEFAULT 0 NOT NULL,
	"max_credits" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "free_pool_daily_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE INDEX "anonymous_usage_date_idx" ON "anonymous_usage_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "anonymous_usage_identifier_idx" ON "anonymous_usage_daily" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "anonymous_usage_date_identifier_idx" ON "anonymous_usage_daily" USING btree ("date","identifier");--> statement-breakpoint
CREATE INDEX "free_pool_date_idx" ON "free_pool_daily" USING btree ("date");