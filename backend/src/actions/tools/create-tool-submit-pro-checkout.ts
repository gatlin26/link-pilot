'use server';

import { randomUUID } from 'crypto';
import { websiteConfig } from '@/config/website';
import { TOOL_ERROR_CODES } from '@/constants/tool-errors';
import { getDb } from '@/db';
import { tools } from '@/db/schema';
import type { User } from '@/lib/auth-types';
import { userActionClient } from '@/lib/safe-action';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { createCheckout } from '@/payment';
import type { CreateCheckoutParams } from '@/payment/types';
import { Routes } from '@/routes';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';

function prodUrlField(msg: string) {
  return z.string().superRefine((val, ctx) => {
    if (isProd && !z.string().url().safeParse(val).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
    }
  });
}

const toolSubmitProCheckoutSchema = z.object({
  name: z
    .string()
    .min(2, 'Tool name must be at least 2 characters')
    .max(100, 'Tool name must not exceed 100 characters'),
  url: z.string().url('Please enter a valid URL'),
  iconUrl: prodUrlField('Logo URL is required'),
  thumbnailUrl: prodUrlField('Screenshot URL is required'),
  imageUrl: prodUrlField('Screenshot URL is required'),
});

/**
 * PRO 工具提交 checkout action
 *
 * 流程：
 * 1. 表单校验 + 重名检查
 * 2. 在事务中创建 unpaid 状态的工具记录
 * 3. 创建 Creem checkout
 * 4. 支付成功后 webhook 将状态更新为 pending
 */
export const createToolSubmitProCheckout = userActionClient
  .schema(toolSubmitProCheckoutSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { name, url, iconUrl, thumbnailUrl, imageUrl } = parsedInput;
    const currentUser = (ctx as { user: User }).user;

    const priceId =
      process.env.NEXT_PUBLIC_CREEM_PRICE_PRO ||
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_TOOL_SUBMIT_PRO ||
      '';

    if (!priceId) {
      return {
        success: false,
        error: 'Pro submit product is not configured',
      } as const;
    }

    try {
      const db = await getDb();
      const nameNormalized = name.trim().toLowerCase();
      const toolId = randomUUID();

      // 生成 slug（复用 submit-tool.ts 中的逻辑）
      let slug: string;
      try {
        const urlObj = new URL(url);
        const baseSlug = urlObj.hostname
          .replace(/^www\./, '')
          .replace(/\./g, '-')
          .toLowerCase();
        slug = `${baseSlug}-${nanoid(6)}`;
      } catch {
        slug = `tool-${nanoid(8)}`;
      }

      // 事务：检查重名 + 创建 unpaid 工具
      await db.transaction(async (tx) => {
        // 锁 + 检查重名
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

        // 创建 unpaid 状态的工具
        await tx.insert(tools).values({
          id: toolId,
          slug,
          name,
          url,
          iconUrl,
          thumbnailUrl,
          imageUrl,
          status: 'unpaid',
          published: false,
          submitterUserId: currentUser.id,
          submitterEmail: currentUser.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const locale = await getLocale();

      const metadata: Record<string, string> = {
        type: 'tool_submit_pro',
        toolId, // 关键：用于 webhook 中更新工具状态
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        toolName: name,
        toolUrl: url,
        toolIconUrl: iconUrl,
        toolThumbnailUrl: thumbnailUrl,
        toolImageUrl: imageUrl,
      };

      if (websiteConfig.features.enableDatafastRevenueTrack) {
        const cookieStore = await cookies();
        metadata.datafast_visitor_id =
          cookieStore.get('datafast_visitor_id')?.value ?? '';
        metadata.datafast_session_id =
          cookieStore.get('datafast_session_id')?.value ?? '';
      }

      const successUrl = getUrlWithLocale(
        `${Routes.SettingsSubmissions}?session_id={CHECKOUT_SESSION_ID}`,
        locale
      );
      const cancelUrl = getUrlWithLocale(Routes.ToolsSubmit, locale);

      const params: CreateCheckoutParams = {
        planId: 'tool_submit_pro',
        priceId,
        customerEmail: currentUser.email,
        metadata,
        successUrl,
        cancelUrl,
        locale,
      };

      const result = await createCheckout(params);

      return {
        success: true,
        data: result,
      } as const;
    } catch (error) {
      console.error('Create tool submit PRO checkout error:', error);
      // 如果是重名错误，返回特定错误码
      if (
        error instanceof Error &&
        error.message === TOOL_ERROR_CODES.duplicateToolName
      ) {
        return {
          success: false,
          error: TOOL_ERROR_CODES.duplicateToolName,
        } as const;
      }
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create checkout session',
      } as const;
    }
  });
