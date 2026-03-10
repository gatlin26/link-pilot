import { getDb } from '@/db/index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Adding deleted_at column to tool_reviews table...');

  const db = await getDb();

  try {
    // Add deleted_at column
    await db.execute(sql`
      ALTER TABLE "tool_reviews"
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp
    `);
    console.log('✓ Added deleted_at column');

    // Create index
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "tool_reviews_deleted_at_idx"
      ON "tool_reviews" ("deleted_at")
    `);
    console.log('✓ Created index tool_reviews_deleted_at_idx');

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
