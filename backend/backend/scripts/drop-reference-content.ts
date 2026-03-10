/**
 * 删除 tools 表的 reference_content 列
 */

import { resolve } from 'node:path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

import { sql } from 'drizzle-orm';
import { getDb } from '../src/db';

async function dropReferenceContent() {
  const db = await getDb();

  try {
    console.log('🔄 正在删除 tools.reference_content 列...\n');

    await db.execute(
      sql`ALTER TABLE tools DROP COLUMN IF EXISTS reference_content`
    );

    console.log('✅ 成功删除 tools.reference_content 列\n');
  } catch (error) {
    console.error('❌ 删除失败:', error);
    process.exit(1);
  }
}

// 执行删除
dropReferenceContent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
