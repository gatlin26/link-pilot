/**
 * 手动删除 types 和 categories 列
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

async function dropColumns() {
  const db = await getDb();

  try {
    console.log('🗑️  正在删除 types 和 categories 列...\n');

    // 删除 types 列
    await db.execute(sql`ALTER TABLE tools DROP COLUMN IF EXISTS types`);
    console.log('✅ 已删除 types 列');

    // 删除 categories 列
    await db.execute(sql`ALTER TABLE tools DROP COLUMN IF EXISTS categories`);
    console.log('✅ 已删除 categories 列');

    console.log('\n✅ 数据库 schema 更新完成！\n');
  } catch (error) {
    console.error('❌ 删除列时出错:', error);
    process.exit(1);
  }

  process.exit(0);
}

dropColumns();
