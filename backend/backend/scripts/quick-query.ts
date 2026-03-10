import { config } from 'dotenv';
config({ path: '.env.local' });

import { like } from 'drizzle-orm';
import { getDb } from '../src/db';
import { user } from '../src/db/schema';

async function main() {
  const db = await getDb();
  const users = await db
    .select({ email: user.email, role: user.role, name: user.name })
    .from(user)
    .where(like(user.email, '%gmail%'))
    .limit(20);

  console.log('Gmail users:');
  for (const u of users) {
    console.log(`  ${u.email} | ${u.role || 'user'} | ${u.name}`);
  }
  process.exit(0);
}

main().catch(console.error);
