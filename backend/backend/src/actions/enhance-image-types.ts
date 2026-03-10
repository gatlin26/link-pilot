/**
 * @file enhance-image-types.ts
 * @description 图片增强相关的类型定义
 * @author git.username
 * @date 2025-12-20
 */

import { z } from 'zod';

// ============================================================
// 错误类型定义
// ============================================================

export enum EnhanceErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED', // 未登录
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS', // 积分不足
  INVALID_IMAGE_URL = 'INVALID_IMAGE_URL', // 无效图片 URL
  REPLICATE_API_ERROR = 'REPLICATE_API_ERROR', // Replicate API 错误
  NETWORK_ERROR = 'NETWORK_ERROR', // 网络错误
  TIMEOUT = 'TIMEOUT', // 超时
  UNKNOWN = 'UNKNOWN', // 未知错误
}

// ============================================================
// Schema 定义
// ============================================================

/** 图片最大大小 (10MB) */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** 支持的图片类型 */
export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** 增强模式类型 */
export type EnhanceMode = 'skin' | 'upscale' | 'restore';

export interface EnhanceImageResult {
  success: boolean;
  enhancedUrl?: string;
  error?: string;
  errorCode?: EnhanceErrorCode;
}
