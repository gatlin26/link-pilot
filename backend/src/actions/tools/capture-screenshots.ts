'use server';

import { getDb } from '@/db';
import { tools } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { processLogo, processThumbnail } from '@/lib/screenshot-processor';
import {
  captureWebsiteLogo,
  captureWebsiteThumbnail,
  isScreenshotEnabled,
} from '@/lib/screenshot-service';
import { uploadFile } from '@/storage';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const captureAndSaveScreenshotsSchema = z.object({
  toolId: z.string(),
  url: z.string().url('Valid URL is required'),
  skipIfExists: z.boolean().default(true),
});

/**
 * 自动截图并保存到 R2
 * 截取网站的 Logo 和缩略图，处理后上传到 R2，更新数据库
 */
export const captureAndSaveScreenshotsAction = adminActionClient
  .schema(captureAndSaveScreenshotsSchema)
  .action(async ({ parsedInput }) => {
    const { toolId, url, skipIfExists } = parsedInput;
    const db = await getDb();

    try {
      // 检查是否启用截图服务
      if (!isScreenshotEnabled()) {
        return {
          success: true,
          skipped: true,
          message: '生产环境暂不支持自动截图',
        };
      }

      // 1. 检查是否已有截图
      if (skipIfExists) {
        const [tool] = await db
          .select({
            iconUrl: tools.iconUrl,
            thumbnailUrl: tools.thumbnailUrl,
          })
          .from(tools)
          .where(eq(tools.id, toolId))
          .limit(1);

        if (tool?.iconUrl && tool?.thumbnailUrl) {
          return {
            success: true,
            skipped: true,
            data: {
              iconUrl: tool.iconUrl,
              thumbnailUrl: tool.thumbnailUrl,
            },
          };
        }
      }

      // 2. 截取 Logo 和缩略图
      console.log(`开始截取网站: ${url}`);
      const [logoBuffer, thumbnailBuffer] = await Promise.all([
        captureWebsiteLogo(url),
        captureWebsiteThumbnail(url),
      ]);

      let iconUrl: string | null = null;
      let thumbnailUrl: string | null = null;

      // 3. 处理并上传 Logo
      if (logoBuffer) {
        try {
          const processedLogo = await processLogo(logoBuffer);
          const logoFilename = `${nanoid()}.webp`;

          const uploadResult = await uploadFile(
            processedLogo,
            logoFilename,
            'image/webp',
            'logos'
          );

          iconUrl = uploadResult.url;
          console.log(`Logo 上传成功: ${iconUrl}`);
        } catch (error) {
          console.error('Logo 处理或上传失败:', error);
        }
      }

      // 4. 处理并上传缩略图
      if (thumbnailBuffer) {
        try {
          const processedThumbnail = await processThumbnail(thumbnailBuffer);
          const thumbnailFilename = `${nanoid()}.webp`;

          const uploadResult = await uploadFile(
            processedThumbnail,
            thumbnailFilename,
            'image/webp',
            'screenshots'
          );

          thumbnailUrl = uploadResult.url;
          console.log(`缩略图上传成功: ${thumbnailUrl}`);
        } catch (error) {
          console.error('缩略图处理或上传失败:', error);
        }
      }

      // 5. 更新数据库
      if (iconUrl || thumbnailUrl) {
        await db
          .update(tools)
          .set({
            iconUrl: iconUrl || undefined,
            thumbnailUrl: thumbnailUrl || undefined,
            imageUrl: thumbnailUrl || undefined, // imageUrl 与 thumbnailUrl 同步
            updatedAt: new Date(),
          })
          .where(eq(tools.id, toolId));
      }

      return {
        success: true,
        data: {
          iconUrl,
          thumbnailUrl,
        },
      };
    } catch (error) {
      console.error('截图失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '截图失败，请稍后重试',
      };
    }
  });

const retryScreenshotSchema = z.object({
  toolId: z.string(),
  url: z.string().url('Valid URL is required'),
  type: z.enum(['logo', 'thumbnail']),
});

/**
 * 手动重试截图
 * 重新截取指定类型的图片
 */
export const retryScreenshotAction = adminActionClient
  .schema(retryScreenshotSchema)
  .action(async ({ parsedInput }) => {
    const { toolId, url, type } = parsedInput;
    const db = await getDb();

    try {
      // 检查是否启用截图服务
      if (!isScreenshotEnabled()) {
        return {
          success: false,
          error: '生产环境暂不支持自动截图',
        };
      }

      console.log(`重新截取 ${type}: ${url}`);

      let resultUrl: string | null = null;

      if (type === 'logo') {
        // 截取并处理 Logo
        const logoBuffer = await captureWebsiteLogo(url);
        if (logoBuffer) {
          const processedLogo = await processLogo(logoBuffer);
          const logoFilename = `${nanoid()}.webp`;

          const uploadResult = await uploadFile(
            processedLogo,
            logoFilename,
            'image/webp',
            'logos'
          );

          resultUrl = uploadResult.url;

          // 更新数据库
          await db
            .update(tools)
            .set({
              iconUrl: resultUrl,
              updatedAt: new Date(),
            })
            .where(eq(tools.id, toolId));
        }
      } else {
        // 截取并处理缩略图
        const thumbnailBuffer = await captureWebsiteThumbnail(url);
        if (thumbnailBuffer) {
          const processedThumbnail = await processThumbnail(thumbnailBuffer);
          const thumbnailFilename = `${nanoid()}.webp`;

          const uploadResult = await uploadFile(
            processedThumbnail,
            thumbnailFilename,
            'image/webp',
            'screenshots'
          );

          resultUrl = uploadResult.url;

          // 更新数据库
          await db
            .update(tools)
            .set({
              thumbnailUrl: resultUrl,
              imageUrl: resultUrl,
              updatedAt: new Date(),
            })
            .where(eq(tools.id, toolId));
        }
      }

      if (!resultUrl) {
        return {
          success: false,
          error: `无法截取${type === 'logo' ? 'Logo' : '缩略图'}`,
        };
      }

      return {
        success: true,
        data: {
          url: resultUrl,
          type,
        },
      };
    } catch (error) {
      console.error(`重试截图失败 (${type}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '截图失败，请稍后重试',
      };
    }
  });
