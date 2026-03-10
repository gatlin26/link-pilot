'use server';

import { getDb } from '@/db';
import { toolReferences } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { fetchUrlContentAction } from './fetch-url-content';

const fetchAndSaveReferenceSchema = z.object({
  toolId: z.string(),
  url: z.string().url('Valid URL is required'),
  autoFetch: z.boolean().default(true),
});

/**
 * 获取并保存参考信息到 tool_references 表
 * 支持自动抓取或手动输入
 */
export const fetchAndSaveReferenceAction = adminActionClient
  .schema(fetchAndSaveReferenceSchema)
  .action(async ({ parsedInput }) => {
    const { toolId, url, autoFetch } = parsedInput;
    const db = await getDb();

    try {
      // 1. 检查是否已存在参考信息
      const [existing] = await db
        .select()
        .from(toolReferences)
        .where(eq(toolReferences.toolId, toolId))
        .limit(1);

      // 2. 自动抓取内容
      let rawTitle: string | null = null;
      let rawDescription: string | null = null;
      let rawContent: string | null = null;
      let status: 'success' | 'failed' = 'failed';
      let fetchError: string | null = null;

      if (autoFetch) {
        const fetchResult = await fetchUrlContentAction({ url });
        if (fetchResult?.data?.success && fetchResult.data.data) {
          const content = fetchResult.data.data.content;
          rawContent = content;
          status = 'success';

          // 尝试从内容中提取 title 和 description
          const titleMatch = content.match(/Title:\s*(.+)/);
          const descMatch = content.match(/Description:\s*(.+)/);

          if (titleMatch) {
            rawTitle = titleMatch[1].trim();
          }
          if (descMatch) {
            rawDescription = descMatch[1].trim();
          }
        } else {
          fetchError = fetchResult?.data?.error || 'Unknown error';
        }
      }

      // 3. 保存或更新到数据库
      const referenceData = {
        id: existing?.id || nanoid(),
        toolId,
        submissionId: null,
        url,
        source: 'auto' as const,
        status,
        rawTitle,
        rawDescription,
        rawContent,
        fetchError,
        fetchedAt: new Date(),
        updatedAt: new Date(),
      };

      if (existing) {
        await db
          .update(toolReferences)
          .set(referenceData)
          .where(eq(toolReferences.id, existing.id));
      } else {
        await db.insert(toolReferences).values({
          ...referenceData,
          createdAt: new Date(),
        });
      }

      return {
        success: true,
        data: referenceData,
      };
    } catch (error) {
      console.error('fetchAndSaveReference error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save reference',
      };
    }
  });

const updateManualReferenceSchema = z.object({
  referenceId: z.string(),
  manualNotes: z.string().optional(),
  manualContent: z.string().optional(),
});

/**
 * 更新手动参考信息
 */
export const updateManualReferenceAction = adminActionClient
  .schema(updateManualReferenceSchema)
  .action(async ({ parsedInput }) => {
    const { referenceId, manualNotes, manualContent } = parsedInput;
    const db = await getDb();

    try {
      await db
        .update(toolReferences)
        .set({
          manualNotes,
          manualContent,
          source: 'manual',
          updatedAt: new Date(),
        })
        .where(eq(toolReferences.id, referenceId));

      return { success: true };
    } catch (error) {
      console.error('updateManualReference error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update reference',
      };
    }
  });

const getToolReferenceSchema = z.object({
  toolId: z.string(),
});

/**
 * 获取工具的参考信息
 */
export const getToolReferenceAction = adminActionClient
  .schema(getToolReferenceSchema)
  .action(async ({ parsedInput }) => {
    const { toolId } = parsedInput;
    const db = await getDb();

    try {
      const [reference] = await db
        .select()
        .from(toolReferences)
        .where(eq(toolReferences.toolId, toolId))
        .limit(1);

      return {
        success: true,
        data: reference || null,
      };
    } catch (error) {
      console.error('getToolReference error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get reference',
      };
    }
  });
