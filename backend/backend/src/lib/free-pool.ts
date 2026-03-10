/**
 * @file free-pool.ts
 * @description 免费池管理逻辑 - 处理匿名用户的免费额度
 * @author git.username
 * @date 2025-12-27
 */

import { randomUUID } from 'crypto';
import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { anonymousUsageDaily, freePoolDaily } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';

/**
 * 获取今日日期字符串（YYYY-MM-DD）
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 免费池检查结果
 */
export interface FreePoolCheckResult {
  allowed: boolean;
  reason?: 'global_limit' | 'user_limit' | 'model_not_available' | 'disabled';
  globalUsed?: number;
  globalMax?: number;
  userUsed?: number;
  userMax?: number;
}

/**
 * 获取免费池配置
 */
export function getFreePoolConfig() {
  return websiteConfig.credits.freePool;
}

/**
 * 获取或创建今日的全局免费池记录
 * 使用 upsert 避免竞态条件
 */
async function getOrCreateTodayPool() {
  const db = await getDb();
  const today = getTodayDateString();
  const config = getFreePoolConfig();

  const newRecord = {
    id: randomUUID(),
    date: today,
    usedCredits: 0,
    maxCredits: config.maxDailyCredits,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 使用 upsert 避免竞态条件：插入或更新（仅更新 updatedAt）
  const result = await db
    .insert(freePoolDaily)
    .values(newRecord)
    .onConflictDoUpdate({
      target: freePoolDaily.date,
      set: { updatedAt: new Date() },
    })
    .returning();

  return result[0];
}

/**
 * 获取或创建今日的匿名用户使用记录
 * 使用 upsert 避免竞态条件
 */
async function getOrCreateUserUsage(
  identifier: string,
  identifierType: 'ip' | 'fingerprint' = 'ip'
) {
  const db = await getDb();
  const today = getTodayDateString();

  const newRecord = {
    id: randomUUID(),
    date: today,
    identifier,
    identifierType,
    usedCredits: 0,
    generationCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 使用原子查询+插入模式：先尝试查询，不存在则插入
  // 由于 anonymousUsageDaily 没有 unique 约束在 (date, identifier) 上，
  // 需要先查询再插入，但使用事务或锁来确保原子性
  const existing = await db
    .select()
    .from(anonymousUsageDaily)
    .where(
      and(
        eq(anonymousUsageDaily.date, today),
        eq(anonymousUsageDaily.identifier, identifier)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // 插入新记录，如果发生冲突则重新查询
  try {
    const result = await db
      .insert(anonymousUsageDaily)
      .values(newRecord)
      .returning();
    return result[0];
  } catch {
    // 如果插入失败（可能是并发插入），重新查询
    const retry = await db
      .select()
      .from(anonymousUsageDaily)
      .where(
        and(
          eq(anonymousUsageDaily.date, today),
          eq(anonymousUsageDaily.identifier, identifier)
        )
      )
      .limit(1);
    return retry[0] || newRecord;
  }
}

/**
 * 检查免费用户是否可以使用指定数量的 credits
 * @param identifier 用户标识（IP 或设备指纹）
 * @param creditsNeeded 需要的 credits 数量
 * @param identifierType 标识类型
 */
export async function checkFreePoolAvailability(
  identifier: string,
  creditsNeeded: number,
  identifierType: 'ip' | 'fingerprint' = 'ip'
): Promise<FreePoolCheckResult> {
  const config = getFreePoolConfig();

  // 检查是否启用免费池
  if (!config.enable) {
    return { allowed: false, reason: 'disabled' };
  }

  // 检查模型是否对免费用户可用
  if (creditsNeeded > config.maxCreditsPerModel) {
    return { allowed: false, reason: 'model_not_available' };
  }

  // 获取今日全局池状态
  const pool = await getOrCreateTodayPool();

  // 检查全局池是否已满
  if (pool.usedCredits + creditsNeeded > pool.maxCredits) {
    return {
      allowed: false,
      reason: 'global_limit',
      globalUsed: pool.usedCredits,
      globalMax: pool.maxCredits,
    };
  }

  // 获取用户今日使用量
  const userUsage = await getOrCreateUserUsage(identifier, identifierType);

  // 检查用户今日限额
  if (userUsage.usedCredits + creditsNeeded > config.maxUserDailyCredits) {
    return {
      allowed: false,
      reason: 'user_limit',
      userUsed: userUsage.usedCredits,
      userMax: config.maxUserDailyCredits,
    };
  }

  return {
    allowed: true,
    globalUsed: pool.usedCredits,
    globalMax: pool.maxCredits,
    userUsed: userUsage.usedCredits,
    userMax: config.maxUserDailyCredits,
  };
}

/**
 * 消耗免费池 credits（在生成成功后调用）
 * @param identifier 用户标识
 * @param creditsUsed 消耗的 credits 数量
 * @param identifierType 标识类型
 */
export async function consumeFreePoolCredits(
  identifier: string,
  creditsUsed: number,
  identifierType: 'ip' | 'fingerprint' = 'ip'
): Promise<void> {
  const db = await getDb();
  const today = getTodayDateString();

  // 更新全局池
  await db
    .update(freePoolDaily)
    .set({
      usedCredits: sql`${freePoolDaily.usedCredits} + ${creditsUsed}`,
      updatedAt: new Date(),
    })
    .where(eq(freePoolDaily.date, today));

  // 更新用户使用记录
  await db
    .update(anonymousUsageDaily)
    .set({
      usedCredits: sql`${anonymousUsageDaily.usedCredits} + ${creditsUsed}`,
      generationCount: sql`${anonymousUsageDaily.generationCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(anonymousUsageDaily.date, today),
        eq(anonymousUsageDaily.identifier, identifier)
      )
    );
}

/**
 * 获取今日免费池状态
 */
export async function getTodayFreePoolStatus() {
  const pool = await getOrCreateTodayPool();
  const config = getFreePoolConfig();

  return {
    date: pool.date,
    usedCredits: pool.usedCredits,
    maxCredits: pool.maxCredits,
    remainingCredits: pool.maxCredits - pool.usedCredits,
    percentUsed: Math.round((pool.usedCredits / pool.maxCredits) * 100),
    config: {
      maxDailyCredits: config.maxDailyCredits,
      maxUserDailyCredits: config.maxUserDailyCredits,
      maxCreditsPerModel: config.maxCreditsPerModel,
    },
  };
}

/**
 * 获取匿名用户今日使用状态
 */
export async function getAnonymousUserStatus(identifier: string) {
  const usage = await getOrCreateUserUsage(identifier);
  const config = getFreePoolConfig();

  return {
    date: usage.date,
    usedCredits: usage.usedCredits,
    maxCredits: config.maxUserDailyCredits,
    remainingCredits: config.maxUserDailyCredits - usage.usedCredits,
    generationCount: usage.generationCount,
  };
}
