-- Migration generated: 2025-02-28
-- Description: Fix tool_tags unique constraint dependencies

-- Step 1: Drop the foreign key constraint that depends on the old index
ALTER TABLE "tool_tag_translations" DROP CONSTRAINT IF EXISTS "tool_tag_translations_slug_fk";

-- Step 2: Drop the old unique index/constraint on tool_tags.slug
ALTER TABLE "tool_tags" DROP CONSTRAINT IF EXISTS "tool_tags_new_slug_key";
DROP INDEX IF EXISTS "tool_tags_new_slug_key";

-- Step 3: Create the new unique constraint (Drizzle will handle this, but we ensure it's clean)
ALTER TABLE "tool_tags" DROP CONSTRAINT IF EXISTS "tool_tags_slug_unique";
ALTER TABLE "tool_tags" ADD CONSTRAINT "tool_tags_slug_unique" UNIQUE ("slug");

-- Step 4: Recreate the foreign key constraint
ALTER TABLE "tool_tag_translations" ADD CONSTRAINT "tool_tag_translations_slug_fk"
    FOREIGN KEY ("slug") REFERENCES "tool_tags"("slug") ON DELETE CASCADE;

-- Step 5: Ensure indexes are correct
DROP INDEX IF EXISTS "tool_tags_slug_idx";
CREATE INDEX IF NOT EXISTS "tool_tags_slug_idx" ON "tool_tags"("slug");

DROP INDEX IF EXISTS "tool_tag_translations_slug_idx";
CREATE INDEX IF NOT EXISTS "tool_tag_translations_slug_idx" ON "tool_tag_translations"("slug");
