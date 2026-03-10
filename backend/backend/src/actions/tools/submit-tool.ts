'use server';

import { TOOL_ERROR_CODES } from '@/constants/tool-errors';
import { getDb } from '@/db';
import { tools } from '@/db/schema';
import type { User } from '@/lib/auth-types';
import { userActionClient } from '@/lib/safe-action';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { verifyBacklinkAction } from './verify-backlink';

/**
 * 生成临时 slug
 * 基于 URL 生成 slug，如果已存在则添加随机后缀
 */
function generateTempSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    // 移除 www. 前缀，将 . 替换为 -
    const baseSlug = urlObj.hostname
      .replace(/^www\./, '')
      .replace(/\./g, '-')
      .toLowerCase();
    // 添加随机后缀确保唯一性
    return `${baseSlug}-${nanoid(6)}`;
  } catch {
    // 如果 URL 解析失败，使用简单的字符串处理
    const baseSlug = url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\//g, '')
      .replace(/\./g, '-')
      .toLowerCase();
    return `${baseSlug}-${nanoid(6)}`;
  }
}

const isProd = process.env.NODE_ENV === 'production';

function prodUrlField(msg: string) {
  return z.string().superRefine((val, ctx) => {
    if (isProd && !z.string().url().safeParse(val).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
    }
  });
}

/**
 * 工具提交表单验证 Schema
 * 非生产环境下 logo / 截图字段不做必须校验，方便测试
 */
const submitToolSchema = z.object({
  name: z
    .string()
    .min(2, 'Tool name must be at least 2 characters')
    .max(100, 'Tool name must not exceed 100 characters'),
  url: z.string().url('Please enter a valid URL'),
  iconUrl: prodUrlField('Logo URL is required'),
  thumbnailUrl: prodUrlField('Screenshot URL is required'),
  imageUrl: prodUrlField('Screenshot URL is required'),
  // Free 提交需要外链验证
  backlinkVerified: z.boolean().default(false),
});

/**
 * 工具提交 Server Action
 * Free 提交：必须通过外链验证才能创建 pending 状态记录
 * 要求用户必须登录
 */
export const submitToolAction = userActionClient
  .schema(submitToolSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const { name, url, iconUrl, thumbnailUrl, imageUrl, backlinkVerified } =
        parsedInput;

      // 服务端重新执行外链验证，不信任客户端传来的布尔值
      const verifyResult = await verifyBacklinkAction(url);
      const isVerified = verifyResult.success && verifyResult.verified;
      if (!isVerified) {
        return {
          success: false,
          error: 'BACKLINK_REQUIRED',
          message: verifyResult.success
            ? 'No backlink found. Please add a link to our site first.'
            : (verifyResult.error ??
              'Failed to verify backlink. Please try again.'),
        } as const;
      }

      const { user } = ctx as { user: User };
      const db = await getDb();

      // 从用户信息中获取邮箱
      const email = user.email;
      if (!email) {
        throw new Error('User email is required');
      }

      const nameNormalized = name.trim().toLowerCase();
      let toolId = '';

      await db.transaction(async (tx) => {
        // 以标准化名称做事务级 advisory lock，避免并发请求绕过重复校验
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${nameNormalized}))`
        );

        const existing = await tx
          .select({ id: tools.id })
          .from(tools)
          .where(sql`lower(trim(${tools.name})) = ${nameNormalized}`)
          .limit(1);
        if (existing.length > 0) {
          throw new Error(TOOL_ERROR_CODES.duplicateToolName);
        }

        const id = nanoid();
        const slug = generateTempSlug(url);

        await tx.insert(tools).values({
          id,
          slug,
          name,
          url,
          iconUrl,
          thumbnailUrl,
          imageUrl,
          status: 'pending',
          published: false,
          submitterUserId: user.id,
          submitterEmail: email,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        toolId = id;
      });

      return {
        success: true,
        message: 'Thank you for your submission! We will review it soon.',
        data: { toolId },
      } as const;
    } catch (error) {
      console.error('submit tool error:', error);
      throw error;
    }
  });
