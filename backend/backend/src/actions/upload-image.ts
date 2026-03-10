/**
 * @file upload-image.ts
 * @description 客户端上传图片到 S3 的 Server Action
 * @author git.username
 * @date 2025-12-20
 */

'use server';

import { uploadFile } from '@/storage';
import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';

const action = createSafeActionClient();

// Base64 大小限制 (10MB)
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const uploadImageSchema = z.object({
  imageBase64: z
    .string()
    .min(1, 'Image is required')
    .refine((val) => {
      // 验证 Base64 格式
      const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
      return base64Regex.test(val);
    }, 'Invalid Base64 format')
    .refine(
      (val) => {
        // 验证解码后大小（考虑 padding）
        const paddingCount = (val.match(/=/g) || []).length;
        const sizeInBytes = Math.ceil((val.length * 3) / 4) - paddingCount;
        return sizeInBytes <= MAX_IMAGE_SIZE_BYTES;
      },
      `Image size exceeds ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`
    ),
  filename: z.string().min(1, 'Filename is required'),
  contentType: z
    .string()
    .refine(
      (val) => ['image/jpeg', 'image/png', 'image/webp'].includes(val),
      'Invalid content type'
    ),
});

export type UploadImageInput = z.infer<typeof uploadImageSchema>;

export interface UploadImageResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * 上传图片到 S3 存储（upload/ 目录）
 */
export const uploadImageToStorage = action
  .schema(uploadImageSchema)
  .action(async ({ parsedInput }): Promise<UploadImageResult> => {
    const { imageBase64, filename, contentType } = parsedInput;

    try {
      // 转换 Base64 为 Buffer
      const buffer = Buffer.from(imageBase64, 'base64');

      // 上传到 upload/ 目录
      const result = await uploadFile(buffer, filename, contentType, 'upload');

      return {
        success: true,
        url: result.url,
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to upload image. Please try again.',
      };
    }
  });
