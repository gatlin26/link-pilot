/**
 * 规范化 tool_translations.introduction 的 Markdown 标题层级
 * 将 ### -> ##, #### -> ###, 等（整体上移一级）
 * 使 introduction 顶层标题对应 H2，符合工具详情页 H1(工具名) 下的结构
 *
 * 使用方法：
 *   pnpm tsx scripts/normalize-introduction-headings.ts
 *   pnpm tsx scripts/normalize-introduction-headings.ts --dry-run  # 仅预览，不执行
 */

import { resolve } from 'path';
import dotenv from 'dotenv';

// 必须在 import db 之前加载 env，否则 postgres 客户端会用错误的 DATABASE_URL
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

if (!process.env.DATABASE_URL) {
  console.error('❌ 未找到 DATABASE_URL，请确认 .env.local 已配置');
  process.exit(1);
}

import { eq } from 'drizzle-orm';
import { toolTranslations } from '../src/db/schema';

/**
 * 将 Markdown 标题整体上移一级：### -> ##, #### -> ###, 等
 * 只处理 ATX 风格标题（行首 # 开头）
 */
function normalizeHeadings(markdown: string): string {
  return markdown.replace(/^(#{1,6})\s+/gm, (_, hashes) => {
    const level = hashes.length;
    if (level <= 1) return hashes + ' '; // # 保持不变
    return '#'.repeat(level - 1) + ' ';
  });
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('🔍 DRY RUN 模式 - 仅预览，不执行数据库更新\n');
  }

  // 动态 import，确保在 dotenv 加载后再创建 DB 连接
  const { getDb } = await import('../src/db');
  const db = await getDb();

  const allRows = await db
    .select({
      id: toolTranslations.id,
      toolId: toolTranslations.toolId,
      locale: toolTranslations.locale,
      introduction: toolTranslations.introduction,
    })
    .from(toolTranslations);

  const toUpdate = allRows.filter(
    (r) => r.introduction != null && r.introduction.trim() !== ''
  );

  let updated = 0;
  let skipped = 0;

  for (const row of toUpdate) {
    const original = row.introduction!;
    const normalized = normalizeHeadings(original);

    if (original === normalized) {
      skipped++;
      continue;
    }

    console.log(
      `  📝 ${row.toolId} (${row.locale}): ${countHeadings(original)} -> ${countHeadings(normalized)}`
    );

    if (!isDryRun) {
      await db
        .update(toolTranslations)
        .set({
          introduction: normalized,
          updatedAt: new Date(),
        })
        .where(eq(toolTranslations.id, row.id));
    }
    updated++;
  }

  console.log('\n========================================');
  console.log('✅ 规范化完成');
  console.log('========================================');
  console.log(`📊 统计: 更新 ${updated} 条, 跳过 ${skipped} 条 (无需变更)`);
  if (isDryRun && updated > 0) {
    console.log('💡 移除 --dry-run 参数以执行实际更新');
  }
  console.log('========================================\n');
}

function countHeadings(md: string): string {
  const counts: Record<number, number> = {};
  md.replace(/^(#{1,6})\s+/gm, (_, hashes) => {
    const n = hashes.length;
    counts[n] = (counts[n] ?? 0) + 1;
    return '';
  });
  return (
    Object.entries(counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => `H${k}:${v}`)
      .join(' ') || 'none'
  );
}

main().catch((err) => {
  console.error('❌ 脚本执行失败:', err?.message || err);
  if (err?.code === 'ECONNREFUSED') {
    try {
      const m = process.env.DATABASE_URL!.match(/@([^/]+)(?:\/|$)/);
      if (m) console.error(`\n   当前连接目标: ${m[1]}`);
    } catch {
      /* ignore */
    }
    console.error('\n💡 连接被拒绝，请确认：');
    console.error('   1. PostgreSQL 已启动（本地）或云数据库可访问');
    console.error('   2. DATABASE_URL 中的主机、端口、网络正确');
    console.error('   3. 若使用云数据库（Neon/Supabase 等），检查网络/防火墙');
  }
  process.exit(1);
});
