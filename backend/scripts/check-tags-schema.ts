/**
 * 检查标签相关表是否与当前代码 schema 一致
 * 用于排查 admin/tags 页面 Server Component 报错
 *
 * 使用: pnpm exec tsx scripts/check-tags-schema.ts
 */
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
config({ path: 'env.prod' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL 未设置');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  console.log('🔍 检查标签表结构...\n');

  // 1. 表是否存在
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('tool_tags', 'tool_tag_translations')
    ORDER BY table_name;
  `;
  const hasToolTags = tables.some((r) => r.table_name === 'tool_tags');
  const hasTranslations = tables.some(
    (r) => r.table_name === 'tool_tag_translations'
  );

  console.log('表存在情况:');
  console.log('  tool_tags:              ', hasToolTags ? '✅' : '❌ 缺失');
  console.log(
    '  tool_tag_translations:   ',
    hasTranslations ? '✅' : '❌ 缺失'
  );

  if (!hasToolTags) {
    console.log('\n⚠️  tool_tags 表不存在，请先执行 Drizzle 迁移（如 0022）');
    await sql.end();
    process.exit(1);
  }

  // 2. tool_tags 列（代码期望: status, sort_order, usage_count，无 locale/name）
  const toolTagsCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tool_tags'
    ORDER BY ordinal_position;
  `;
  const colNames = toolTagsCols.map((r) => r.column_name);
  const hasStatus = colNames.includes('status');
  const hasLocale = colNames.includes('locale');
  const hasName = colNames.includes('name');

  console.log('\ntool_tags 关键列:');
  console.log('  status:   ', hasStatus ? '✅' : '❌（代码需要）');
  console.log('  locale:   ', hasLocale ? '⚠️ 存在（旧单表结构）' : '✅ 无');
  console.log('  name:     ', hasName ? '⚠️ 存在（旧单表结构）' : '✅ 无');

  if (!hasTranslations) {
    console.log('\n❌ 结论: 缺少 tool_tag_translations 表');
    console.log(
      '   当前代码期望两表结构（主表 + 翻译表），但数据库仍是 0022 的单表结构。'
    );
    console.log('   请执行手动迁移: pnpm exec tsx run-migration.ts');
    console.log(
      '   （会读取并执行项目根目录 MIGRATION_0024_refactor_tags.sql）'
    );
    await sql.end();
    process.exit(1);
  }

  if (hasLocale || hasName) {
    console.log(
      '\n⚠️  tool_tags 仍含 locale/name，建议执行 MIGRATION_0024 以与代码一致'
    );
  } else {
    console.log('\n✅ 表结构符合当前代码，admin/tags 不应因表结构报错');
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
