/**
 * @file enhance-image.ts
 * @description 图片增强 Server Action
 * @author git.username
 * @date 2025-12-20
 */

'use server';

import { randomUUID } from 'crypto';
import { consumeCredits, hasEnoughCredits } from '@/credits/credits';
import { getDb } from '@/db';
import { imageRecord } from '@/db/schema';
import { auth } from '@/lib/auth';
import { uploadFile } from '@/storage';
import { headers } from 'next/headers';
import Replicate from 'replicate';
import {
  ALLOWED_CONTENT_TYPES,
  EnhanceErrorCode,
  type EnhanceImageResult,
  type EnhanceMode,
  MAX_IMAGE_SIZE_BYTES,
} from './enhance-image-types';

// ============================================================
// 常量配置
// ============================================================

/** 每种模式的积分消耗 */
const ENHANCE_CREDIT_COST = {
  skin: 1,
  upscale: 2, // 未实现
  restore: 2, // 未实现
} as const;

/** 超时时间：60秒 */
// replicate-javascript 的 wait.timeout 单位是“秒”（要求 1~60），不是毫秒
const REPLICATE_WAIT_TIMEOUT_SEC = 60;

// 输出格式由 Replicate 返回的原始格式决定，不做转换
type OutputFormat = 'jpeg' | 'png' | 'webp';

/** Replicate 模型配置 */
const REPLICATE_MODEL =
  'sczhou/codeformer:cc4956dd26fa5a7185d5660cc9100fab1b8070a1d1654a8bb5eb6d443b020bb2';

// ============================================================
// Replicate 客户端初始化
// ============================================================

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  console.error(
    'REPLICATE_API_TOKEN is not configured. Image enhancement will fail.'
  );
}

const replicate = new Replicate({
  auth: REPLICATE_API_TOKEN,
});

// ============================================================
// 工具函数
// ============================================================

/**
 * 从 URL 下载图片并返回 Buffer 和 content-type
 * 支持重试机制以处理网络不稳定的情况
 */
async function fetchImageAsBuffer(
  url: string,
  maxSizeBytes = 50 * 1024 * 1024,
  maxRetries = 3
): Promise<{ buffer: Buffer; contentType: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    // 增加超时时间到 90 秒，适应大文件下载
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      console.log(
        `[fetchImageAsBuffer] Attempt ${attempt}/${maxRetries}: ${url}`
      );

      const response = await fetch(url, {
        signal: controller.signal,
        // 添加 keep-alive 保持连接
        headers: {
          Connection: 'keep-alive',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 验证 Content-Type
      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      // 检查文件大小
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const size = Number.parseInt(contentLength);
        console.log(
          `[fetchImageAsBuffer] File size: ${(size / 1024 / 1024).toFixed(2)} MB`
        );

        if (size > maxSizeBytes) {
          throw new Error(
            `Image too large: ${(size / 1024 / 1024).toFixed(2)} MB (max: ${(maxSizeBytes / 1024 / 1024).toFixed(2)} MB)`
          );
        }
      }

      const arrayBuffer = await response.arrayBuffer();

      if (arrayBuffer.byteLength > maxSizeBytes) {
        throw new Error(
          `Image exceeds size limit: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
        );
      }

      console.log(
        `[fetchImageAsBuffer] Successfully downloaded: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
      );
      clearTimeout(timeout);
      return { buffer: Buffer.from(arrayBuffer), contentType };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error(String(error));

      console.error(`[fetchImageAsBuffer] Attempt ${attempt} failed:`, {
        error: lastError.message,
        cause: (lastError as any).cause,
        url,
      });

      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 递增等待时间：2s, 4s, 6s
        console.log(`[fetchImageAsBuffer] Retrying in ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  // 所有重试都失败了
  throw new Error(
    `Failed to download image after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * 上传原图到 upload/ 目录
 */
async function uploadOriginalImage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const ext = filename.split('.').pop() || 'jpg';
  const uniqueFilename = `original-${timestamp}-${randomSuffix}.${ext}`;
  const result = await uploadFile(
    buffer,
    uniqueFilename,
    contentType,
    'upload'
  );
  return result.url;
}

/**
 * 上传增强后的图片到 production/ 目录
 */
async function uploadEnhancedImage(
  buffer: Buffer,
  opts: { ext: string; contentType: string }
): Promise<string> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const filename = `enhanced-${timestamp}-${randomSuffix}.${opts.ext}`;
  const result = await uploadFile(
    buffer,
    filename,
    opts.contentType,
    'production'
  );
  return result.url;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseBoolean(raw: FormDataEntryValue | null, defaultValue: boolean) {
  if (typeof raw !== 'string') return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return defaultValue;
}

function parseReplicateUpscale(raw: FormDataEntryValue | null) {
  // Replicate schema: integer, default 2.（未标注 min/max，这里做保守夹逼）
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(n)) return 2;
  return clamp(n, 1, 4);
}

function parseReplicateFidelity(raw: FormDataEntryValue | null) {
  // Replicate schema: number in [0, 1], default 0.5
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : Number.NaN;
  if (!Number.isFinite(n)) return 0.5;
  return clamp(n, 0, 1);
}

function mapOutputToContentTypeAndExt(format: OutputFormat) {
  switch (format) {
    case 'png':
      return { contentType: 'image/png', ext: 'png' } as const;
    case 'webp':
      return { contentType: 'image/webp', ext: 'webp' } as const;
    default:
      return { contentType: 'image/jpeg', ext: 'jpg' } as const;
  }
}

/**
 * 从 content-type 提取格式
 */
function getFormatFromContentType(contentType: string): OutputFormat {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpeg';
}

/**
 * 调用 Replicate API 进行皮肤增强
 */
async function callReplicateEnhance(
  imageUrl: string,
  opts: {
    upscale: number;
    faceUpsample: boolean;
    backgroundEnhance: boolean;
    fidelity: number;
  }
): Promise<string> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const output = await replicate.run(REPLICATE_MODEL, {
    input: {
      image: imageUrl,
      upscale: opts.upscale,
      face_upsample: opts.faceUpsample,
      background_enhance: opts.backgroundEnhance,
      codeformer_fidelity: opts.fidelity,
    },
    wait: {
      mode: 'block',
      timeout: REPLICATE_WAIT_TIMEOUT_SEC,
      interval: 2000,
    },
  });

  // 验证输出格式
  if (!output || typeof output !== 'object') {
    throw new Error('Invalid Replicate output format');
  }

  // Replicate FileOutput 对象有 url() 方法
  if ('url' in output && typeof output.url === 'function') {
    const resultUrl = output.url();
    if (!resultUrl) {
      throw new Error('No output URL from Replicate');
    }
    return resultUrl;
  }

  // 兼容：某些模型可能直接返回 URL 字符串
  if (typeof output === 'string') {
    return output;
  }

  throw new Error(`Unexpected Replicate output type: ${typeof output}`);
}

/**
 * 映射错误到错误码
 */
function mapErrorCode(error: Error): EnhanceErrorCode {
  const message = error.message.toLowerCase();

  if (message.includes('timeout') || message.includes('timed out')) {
    return EnhanceErrorCode.TIMEOUT;
  }

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection')
  ) {
    return EnhanceErrorCode.NETWORK_ERROR;
  }

  if (
    message.includes('replicate') ||
    message.includes('api') ||
    message.includes('model')
  ) {
    return EnhanceErrorCode.REPLICATE_API_ERROR;
  }

  if (message.includes('invalid') && message.includes('url')) {
    return EnhanceErrorCode.INVALID_IMAGE_URL;
  }

  return EnhanceErrorCode.UNKNOWN;
}

// ============================================================
// Server Action
// ============================================================

/**
 * 图片增强 Server Action
 * @param formData - 包含 file (File) 和 mode (string) 的 FormData
 */
export async function enhanceImage(
  formData: FormData
): Promise<EnhanceImageResult> {
  const db = await getDb();

  // 1. 用户认证检查
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      success: false,
      errorCode: EnhanceErrorCode.UNAUTHORIZED,
      error: 'Please login first',
    };
  }

  const userId = session.user.id;

  // 2. 解析 FormData
  const file = formData.get('file') as File | null;
  const mode = (formData.get('mode') as EnhanceMode) || 'skin';
  // Replicate 参数：严格对齐模型 schema（仅暴露其支持的字段）
  const replicateUpscale = parseReplicateUpscale(formData.get('upscale'));
  const replicateFaceUpsample = parseBoolean(
    formData.get('face_upsample'),
    true
  );
  const replicateBackgroundEnhance = parseBoolean(
    formData.get('background_enhance'),
    true
  );
  const replicateFidelity = parseReplicateFidelity(
    formData.get('codeformer_fidelity')
  );

  if (!file) {
    return {
      success: false,
      error: 'No file provided',
    };
  }

  // 3. 验证文件
  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    return {
      success: false,
      error: 'Unsupported image type. Use JPEG, PNG, or WebP.',
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      success: false,
      error: `Image size exceeds ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB limit`,
    };
  }

  // 4. 检查模式是否可用
  if (mode !== 'skin') {
    return {
      success: false,
      error: 'This mode is not yet available',
    };
  }

  // 5. 积分检查
  const requiredCredits = ENHANCE_CREDIT_COST[mode];
  const hasCredits = await hasEnoughCredits({ userId, requiredCredits });

  if (!hasCredits) {
    return {
      success: false,
      errorCode: EnhanceErrorCode.INSUFFICIENT_CREDITS,
      error: `Insufficient credits. You need ${requiredCredits} credits.`,
    };
  }

  let imageUrl: string | undefined;

  try {
    // 6. 上传原图到 upload/ 目录（不做预处理，直接上传）
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);
    const inputContentType = file.type || 'image/jpeg';

    // 确保文件名后缀与 content-type 对齐
    const inputFilename =
      inputContentType === 'image/png'
        ? file.name.replace(/\.[^.]+$/, '.png')
        : inputContentType === 'image/webp'
          ? file.name.replace(/\.[^.]+$/, '.webp')
          : file.name.replace(/\.[^.]+$/, '.jpg');

    imageUrl = await uploadOriginalImage(
      originalBuffer,
      inputFilename,
      inputContentType
    );

    // 7. 调用 Replicate API 进行增强
    const enhancedImageUrl = await callReplicateEnhance(imageUrl, {
      upscale: replicateUpscale,
      faceUpsample: replicateFaceUpsample,
      backgroundEnhance: replicateBackgroundEnhance,
      fidelity: replicateFidelity,
    });

    // 8. 下载增强结果并上传到 production/（不做后处理，保持原样）
    const { buffer: enhancedBuffer, contentType: enhancedContentType } =
      await fetchImageAsBuffer(enhancedImageUrl);
    const format = getFormatFromContentType(enhancedContentType);
    const { contentType, ext } = mapOutputToContentTypeAndExt(format);
    const enhancedUrl = await uploadEnhancedImage(enhancedBuffer, {
      contentType,
      ext,
    });

    // 9. 消费积分
    await consumeCredits({
      userId,
      amount: requiredCredits,
      description: `Image enhancement (${mode})`,
    });

    // 10. 记录成功到数据库
    await db.insert(imageRecord).values({
      id: randomUUID(),
      userId,
      type: 'enhance',
      status: 'success',
      provider: 'replicate',
      model: 'codeformer',
      inputUrl: imageUrl,
      outputUrl: enhancedUrl,
      creditsUsed: requiredCredits,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      success: true,
      enhancedUrl,
    };
  } catch (error) {
    console.error('Error enhancing image:', error);

    // 记录失败到数据库
    try {
      await db.insert(imageRecord).values({
        id: randomUUID(),
        userId,
        type: 'enhance',
        status: 'failed',
        provider: 'replicate',
        model: 'codeformer',
        inputUrl: imageUrl || '',
        creditsUsed: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (dbError) {
      console.error('Failed to record error:', dbError);
    }

    const errorCode =
      error instanceof Error ? mapErrorCode(error) : EnhanceErrorCode.UNKNOWN;

    return {
      success: false,
      errorCode,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to enhance image. Please try again.',
    };
  }
}
