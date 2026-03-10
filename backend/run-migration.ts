import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// 加载环境变量
config({ path: '.env.local' });
config({ path: 'env.prod' });

// 从环境变量读取数据库连接
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL 环境变量未设置');
  process.exit(1);
}

console.log('🔗 连接到数据库...');
const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

async function runMigration() {
  try {
    console.log('📊 检查当前标签数据...');

    // 检查当前表结构
    const checkTable = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tool_tags'
      ORDER BY ordinal_position;
    `;

    console.log('当前 tool_tags 表结构：');
    console.table(checkTable);

    // 检查标签数量
    const countResult = await sql`SELECT COUNT(*) as count FROM tool_tags;`;
    const tagCount = countResult[0].count;
    console.log(`\n📝 当前标签数量: ${tagCount}`);

    if (tagCount === 0) {
      console.log('⚠️  数据库中没有标签数据，跳过迁移');
      await sql.end();
      return;
    }

    // 读取迁移 SQL
    const migrationPath = path.join(
      process.cwd(),
      'MIGRATION_0024_refactor_tags.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('\n⚠️  准备执行迁移...');
    console.log('⚠️  这将修改数据库结构，请确保已备份数据！');
    console.log('\n按 Ctrl+C 取消，或等待 5 秒后自动继续...\n');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('🚀 开始执行迁移...\n');

    // 执行迁移
    await sql.unsafe(migrationSql);

    console.log('\n✅ 迁移执行成功！\n');

    // 验证迁移结果
    console.log('📊 验证迁移结果...\n');

    const mainTableCount = await sql`SELECT COUNT(*) as count FROM tool_tags;`;
    const translationTableCount =
      await sql`SELECT COUNT(*) as count FROM tool_tag_translations;`;

    console.log(`✅ 主表记录数: ${mainTableCount[0].count}`);
    console.log(`✅ 翻译表记录数: ${translationTableCount[0].count}`);

    // 检查新表结构
    const newStructure = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tool_tags'
      ORDER BY ordinal_position;
    `;

    console.log('\n新的 tool_tags 表结构：');
    console.table(newStructure);

    const translationStructure = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tool_tag_translations'
      ORDER BY ordinal_position;
    `;

    console.log('\ntool_tag_translations 表结构：');
    console.table(translationStructure);

    // 检查是否有标签缺少翻译
    const missingTranslations = await sql`
      SELECT slug, COUNT(*) as translation_count
      FROM tool_tag_translations
      GROUP BY slug
      HAVING COUNT(*) != 2;
    `;

    if (missingTranslations.length > 0) {
      console.log('\n⚠️  以下标签缺少翻译：');
      console.table(missingTranslations);
    } else {
      console.log('\n✅ 所有标签都有完整的翻译');
    }

    console.log('\n🎉 迁移完成！');
  } catch (error) {
    console.error('\n❌ 迁移失败：', error);
    throw error;
  } finally {
    await sql.end();
  }
}

runMigration().catch((error) => {
  console.error('执行失败：', error);
  process.exit(1);
});
