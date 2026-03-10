'use server';

import { getDb } from '@/db';
import { tools } from '@/db/schema';
import { and, eq, lt } from 'drizzle-orm';

/**
 * 清理超过30分钟未支付的工具草稿
 * 可作为 cron job 定期执行
 */
export async function cleanupUnpaidTools() {
  try {
    const db = await getDb();
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const result = await db
      .delete(tools)
      .where(
        and(eq(tools.status, 'unpaid'), lt(tools.createdAt, thirtyMinutesAgo))
      )
      .returning({ id: tools.id });

    console.log(`[Cleanup] Deleted ${result.length} unpaid tools`);
    return { success: true, count: result.length };
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    return { success: false, error: 'Failed to cleanup' };
  }
}
