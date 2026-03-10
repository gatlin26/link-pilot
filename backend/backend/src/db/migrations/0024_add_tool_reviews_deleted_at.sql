-- Add deleted_at column to tool_reviews table for soft delete functionality
ALTER TABLE "tool_reviews" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

-- Create index for deleted_at column
CREATE INDEX IF NOT EXISTS "tool_reviews_deleted_at_idx" ON "tool_reviews" ("deleted_at");
