/**
 * EvoLink (Nanobanana) 图像生成适配器
 *
 * 所有 EvoLink 第三方 HTTP 调用必须通过本文件。
 * 路由层（submit/poll/webhook）不得直接散落 EvoLink HTTP 细节。
 */

import { SignJWT, jwtVerify } from 'jose';

// ============================================================================
// 类型定义
// ============================================================================

export type EvoLinkTaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface EvoLinkCreateImageRequest {
  prompt: string;
  model: string;
  size?: string;
  quality?: string; // 图片质量（nano-banana-pro 支持）
  n?: number; // 生成图片数量（seedream-4.5 支持）
  prompt_priority?: string; // 提示词优化策略（seedream-4.5 支持）
  seed?: number; // 随机种子，用于可重现结果（z-image-turbo 支持，范围：1-2147483647）
  nsfw_check?: boolean; // NSFW 内容审核（z-image-turbo 支持）
  image_urls?: string[]; // 图生图/编辑时的输入图
  callback_url?: string; // webhook 回调地址
}

export interface EvoLinkCreateImageResponse {
  created: number; // 任务创建时间戳
  id: string; // 任务 ID
  model: string; // 实际使用的模型名
  object: string; // 任务类型，如 "image.generation.task"
  progress: number; // 任务进度 0-100
  status: EvoLinkTaskStatus;
  task_info?: {
    can_cancel: boolean;
    estimated_time: number; // 预计完成时间（秒）
  };
  type: string; // 任务输出类型，如 "image"
  usage?: {
    billing_rule: string; // 计费规则
    credits_reserved: number; // 预估消耗积分
    user_group: string; // 用户组
  };
}

export interface EvoLinkTaskDetailResponse {
  created: number; // 任务创建时间戳
  id: string;
  model: string; // 使用的模型
  object: string; // 任务类型
  progress: number; // 0~100
  results?: string[]; // completed 时的结果 URLs（24h 过期）
  status: EvoLinkTaskStatus;
  task_info?: {
    can_cancel: boolean;
  };
  type: string; // 任务类型，如 "image"
  error?: string; // 失败时的错误信息
}

export interface EvoLinkError {
  code: string;
  message: string;
  statusCode: number;
}

// 统一的领域模型（返回给路由层）
export interface ImageGenerationTask {
  taskId: string;
  status: EvoLinkTaskStatus;
  progress: number;
  resultUrls?: string[];
  error?: string;
}

export interface PollTokenPayload {
  taskId: string;
  userId: string;
  exp: number;
}

// ============================================================================
// 配置
// ============================================================================

const EVOLINK_API_BASE = 'https://api.evolink.ai/v1';
const POLL_TOKEN_EXPIRY_HOURS = 2;

function getApiKey(): string {
  const key = process.env.EVOLINK_API_KEY;
  if (!key) {
    throw new Error('EVOLINK_API_KEY environment variable is not set');
  }
  return key;
}

function getPollTokenSecret(): Uint8Array {
  const secret = process.env.POLL_TOKEN_SECRET;
  if (!secret) {
    throw new Error('POLL_TOKEN_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

function getWebhookSecret(): string {
  // 与 poll token 共用同一个密钥
  const secret = process.env.POLL_TOKEN_SECRET;
  if (!secret) {
    throw new Error('POLL_TOKEN_SECRET environment variable is not set');
  }
  return secret;
}

// ============================================================================
// API 调用
// ============================================================================

/**
 * 创建图像生成任务
 * POST https://api.evolink.ai/v1/images/generations
 */
export async function createImageGeneration(
  payload: EvoLinkCreateImageRequest
): Promise<ImageGenerationTask> {
  const response = await fetch(`${EVOLINK_API_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await mapEvoLinkHttpError(response);
  }

  const data = (await response.json()) as EvoLinkCreateImageResponse;

  return {
    taskId: data.id,
    status: data.status,
    progress: data.progress || 0,
  };
}

/**
 * 查询任务状态
 * GET https://api.evolink.ai/v1/tasks/{taskId}
 */
export async function getTaskDetail(
  taskId: string
): Promise<ImageGenerationTask> {
  const response = await fetch(`${EVOLINK_API_BASE}/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });

  if (!response.ok) {
    throw await mapEvoLinkHttpError(response);
  }

  const data = (await response.json()) as EvoLinkTaskDetailResponse;

  return {
    taskId: data.id,
    status: data.status,
    progress: data.progress,
    resultUrls: data.results,
    error: data.error,
  };
}

// ============================================================================
// Token 工具
// ============================================================================

/**
 * 生成轮询 token（JWT，2小时过期）
 */
export async function generatePollToken(
  taskId: string,
  userId: string
): Promise<string> {
  const secret = getPollTokenSecret();
  const exp = Math.floor(Date.now() / 1000) + POLL_TOKEN_EXPIRY_HOURS * 60 * 60;

  const token = await new SignJWT({ taskId, userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(exp)
    .sign(secret);

  return token;
}

/**
 * 验证轮询 token
 * 返回 payload 或抛出错误
 */
export async function verifyPollToken(
  token: string,
  expectedTaskId: string,
  expectedUserId: string
): Promise<PollTokenPayload> {
  const secret = getPollTokenSecret();

  try {
    const { payload } = await jwtVerify(token, secret);

    const tokenTaskId = payload.taskId as string;
    const tokenUserId = payload.userId as string;

    if (tokenTaskId !== expectedTaskId) {
      throw new Error('Token taskId mismatch');
    }

    if (tokenUserId !== expectedUserId) {
      throw new Error('Token userId mismatch');
    }

    return {
      taskId: tokenTaskId,
      userId: tokenUserId,
      exp: payload.exp as number,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid poll token: ${error.message}`);
    }
    throw new Error('Invalid poll token');
  }
}

/**
 * 仅验证 token 有效性并提取 payload（不校验 taskId/userId）
 * 用于轮询接口：token 里已包含 taskId/userId
 */
export async function decodePollToken(
  token: string
): Promise<PollTokenPayload> {
  const secret = getPollTokenSecret();

  try {
    const { payload } = await jwtVerify(token, secret);

    return {
      taskId: payload.taskId as string,
      userId: payload.userId as string,
      exp: payload.exp as number,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid poll token: ${error.message}`);
    }
    throw new Error('Invalid poll token');
  }
}

/**
 * 生成 webhook token（用于 callback_url）
 */
export async function generateWebhookToken(taskId: string): Promise<string> {
  const secret = new TextEncoder().encode(getWebhookSecret());

  const token = await new SignJWT({ taskId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h') // webhook token 有效期更长
    .sign(secret);

  return token;
}

/**
 * 验证 webhook token
 */
export async function verifyWebhookToken(
  token: string
): Promise<{ taskId: string }> {
  const secret = new TextEncoder().encode(getWebhookSecret());

  try {
    const { payload } = await jwtVerify(token, secret);
    return { taskId: payload.taskId as string };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid webhook token: ${error.message}`);
    }
    throw new Error('Invalid webhook token');
  }
}

// ============================================================================
// 错误处理
// ============================================================================

/**
 * 映射 EvoLink HTTP 错误为统一格式
 */
async function mapEvoLinkHttpError(response: Response): Promise<EvoLinkError> {
  let message = 'Unknown error';

  try {
    const body = await response.json();
    message = body.message || body.error || message;
  } catch {
    message = response.statusText || message;
  }

  const errorMap: Record<number, string> = {
    400: 'INVALID_REQUEST',
    401: 'UNAUTHORIZED',
    402: 'INSUFFICIENT_CREDITS',
    403: 'FORBIDDEN',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
  };

  return {
    code: errorMap[response.status] || 'UNKNOWN_ERROR',
    message,
    statusCode: response.status,
  };
}

/**
 * 映射任意错误为 EvoLinkError
 */
export function mapEvoLinkError(error: unknown): EvoLinkError {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'statusCode' in error
  ) {
    return error as EvoLinkError;
  }

  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
      statusCode: 500,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    statusCode: 500,
  };
}

// ============================================================================
// 辅助工具
// ============================================================================

/**
 * 从三方临时 URL 下载图片
 */
export async function downloadImageFromUrl(
  url: string,
  options?: { maxSizeBytes?: number; timeoutMs?: number }
): Promise<{ buffer: Buffer; contentType: string }> {
  const { maxSizeBytes = 50 * 1024 * 1024, timeoutMs = 90000 } = options || {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download image: ${response.status} ${response.statusText}`
      );
    }

    // 检查文件大小
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number.parseInt(contentLength, 10) > maxSizeBytes) {
      throw new Error(`Image size exceeds limit: ${contentLength} bytes`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 获取 content-type，有 fallback
    let contentType = response.headers.get('content-type') || 'image/png';

    // 修正不可信的 content-type（用魔数识别）
    contentType = detectImageType(buffer) || contentType;

    return { buffer, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 通过魔数检测图片类型
 */
function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // GIF: 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }

  return null;
}

/**
 * 根据 content-type 获取文件扩展名
 */
export function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return map[contentType] || 'png';
}
