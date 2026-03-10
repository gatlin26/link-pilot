'use server';

import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { toolTranslations, tools } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

/**
 * 生成 URL slug
 * 将 URL 转换为 slug 格式，例如 https://example.com -> example-com
 */
function generateSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    // 移除 www. 前缀，将 . 替换为 -
    return urlObj.hostname
      .replace(/^www\./, '')
      .replace(/\./g, '-')
      .toLowerCase();
  } catch {
    // 如果 URL 解析失败，使用简单的字符串处理
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\//g, '')
      .replace(/\./g, '-')
      .toLowerCase();
  }
}

/**
 * 审批提交的参数 Schema（简单审批，不创建工具记录）
 */
const approveSubmissionSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
});

/**
 * 批准工具提交（仅管理员）- 简单审批
 * 仅更新状态为 published，清除拒绝原因
 */
export const approveSubmissionAction = adminActionClient
  .schema(approveSubmissionSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { toolId } = parsedInput;
      const db = await getDb();

      // 更新状态为已批准，清除拒绝原因
      await db
        .update(tools)
        .set({
          status: 'published',
          published: true,
          rejectReason: null,
          updatedAt: new Date(),
        })
        .where(eq(tools.id, toolId));

      return {
        success: true,
        message: 'Submission approved successfully',
      } as const;
    } catch (error) {
      console.error('approve submission error:', error);
      throw error;
    }
  });

/**
 * 完整审批的参数 Schema（更新工具记录并发布）
 */
const approveAndPublishSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
  // 基础信息
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  tags: z.array(z.string()),
  // 图片字段
  iconUrl: z.string().url().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  // 多语言翻译
  translations: z.record(
    z.string(),
    z.object({
      title: z.string().default(''),
      description: z.string().default(''),
      introduction: z.string().default(''),
    })
  ),
});

/**
 * 批准并发布工具（仅管理员）
 * 更新工具记录和多语言翻译，设置状态为 published
 */
export const approveAndPublishAction = adminActionClient
  .schema(approveAndPublishSchema)
  .action(async ({ parsedInput }) => {
    try {
      const {
        toolId,
        name,
        url,
        tags,
        iconUrl,
        thumbnailUrl,
        imageUrl,
        translations,
      } = parsedInput;

      const db = await getDb();

      // 获取现有工具记录
      const existingTool = await db
        .select({ id: tools.id, slug: tools.slug })
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1);

      if (existingTool.length === 0) {
        return { success: false, error: 'Tool not found' };
      }

      // 生成新的 slug（基于 URL，不带随机后缀）
      const newSlug = generateSlug(url);

      // 检查新 slug 是否与其他工具冲突
      const slugConflict = await db
        .select({ id: tools.id })
        .from(tools)
        .where(eq(tools.slug, newSlug))
        .limit(1);

      if (slugConflict.length > 0 && slugConflict[0].id !== toolId) {
        return {
          success: false,
          error: `Tool with slug "${newSlug}" already exists`,
        };
      }

      // 1. 更新工具主记录
      await db
        .update(tools)
        .set({
          slug: newSlug,
          name,
          url,
          tags: JSON.stringify(tags),
          iconUrl: iconUrl || null,
          thumbnailUrl: thumbnailUrl || null,
          imageUrl: imageUrl || null,
          status: 'published',
          published: true,
          rejectReason: null,
          collectionTime: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tools.id, toolId));

      // 2. 删除现有翻译（如果有）
      await db
        .delete(toolTranslations)
        .where(eq(toolTranslations.toolId, toolId));

      // 3. 插入所有语言翻译
      for (const [locale, content] of Object.entries(translations)) {
        if (content.title && content.description && content.introduction) {
          await db.insert(toolTranslations).values({
            id: nanoid(),
            toolId,
            locale,
            title: content.title,
            description: content.description,
            introduction: content.introduction,
          });
        }
      }

      // 4. 触发 ISR 重新验证
      const locales = Object.keys(websiteConfig.i18n.locales);
      for (const locale of locales) {
        if (locale === websiteConfig.i18n.defaultLocale) {
          revalidatePath('/tools');
          revalidatePath(`/tools/${newSlug}`);
        } else {
          revalidatePath(`/${locale}/tools`);
          revalidatePath(`/${locale}/tools/${newSlug}`);
        }
      }

      return {
        success: true,
        message: 'Tool published successfully',
        data: { toolId, slug: newSlug },
      } as const;
    } catch (error) {
      console.error('approve and publish error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to publish tool',
      };
    }
  });
