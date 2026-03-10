/**
 * 提交生图任务 API
 * POST /api/image-generation/submit
 *
 * 职责：
 * 1. 验证用户登录
 * 2. 写入 image_record
 * 3. 调用 EvoLink 创建任务
 * 4. 返回 taskId + token + status
 */

import { randomUUID } from 'node:crypto';
import {
  calculateCreditsForGeneration,
  getEvolinkModelId,
} from '@/config/ai-models-config';
import { consumeCredits } from '@/credits/credits';
import { getDb } from '@/db';
import { imageRecord } from '@/db/schema';
import { auth } from '@/lib/auth';
import {
  createImageGeneration,
  generatePollToken,
  generateWebhookToken,
  mapEvoLinkError,
} from '@/services/image-providers/evolink';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ============================================================================
// 请求验证
// ============================================================================

const submitRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(2000),
  model: z.string().min(1, 'Model is required'),
  size: z.string().optional().default('1:1'),
  quality: z.string().optional(), // 图片质量 ('1K' | '2K' | '4K')
  image_urls: z.array(z.string().url()).optional(),
  seed: z.number().int().min(1).max(2147483647).optional(), // 随机种子（z-image-turbo 支持）
  nsfw_check: z.boolean().optional(), // NSFW 内容审核（z-image-turbo 支持）
  is_public: z.boolean().optional().default(true), // 是否公开可见（用于 Gallery 展示）
});

type SubmitRequest = z.infer<typeof submitRequestSchema>;

// ============================================================================
// 配置
// ============================================================================

const EVOLINK_PROVIDER = 'evolink';

function getWebhookBaseUrl(): string {
  // 优先用环境变量配置的 webhook URL，否则用当前请求的 origin
  return process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(req: NextRequest) {
  const db = await getDb();

  try {
    // 1. 验证登录
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. 解析并验证请求体
    let body: SubmitRequest;
    try {
      const rawBody = await req.json();
      body = submitRequestSchema.parse(rawBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request', details: error.issues },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 3. 生成 webhook URL（带 token）
    // 先生成一个临时 taskId 用于 webhook token（实际 taskId 由 EvoLink 返回）
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const webhookToken = await generateWebhookToken(tempId);
    const webhookBaseUrl = getWebhookBaseUrl();
    const callbackUrl = webhookBaseUrl
      ? `${webhookBaseUrl}/api/webhooks/evolink-image-task?token=${webhookToken}`
      : undefined;

    // 4. 将前端模型 ID 映射到 EvoLink 模型标识符
    const evolinkModel = getEvolinkModelId(body.model);
    if (!evolinkModel) {
      return NextResponse.json(
        { error: `Unsupported model: ${body.model}` },
        { status: 400 }
      );
    }

    // 5. 调用 EvoLink 创建任务
    const task = await createImageGeneration({
      prompt: body.prompt,
      model: evolinkModel,
      size: body.size,
      image_urls: body.image_urls,
      seed: body.seed,
      nsfw_check: body.nsfw_check,
      callback_url: callbackUrl,
    });

    // 5.5 计算积分消耗（根据模型和质量动态调整）
    const creditsCost = calculateCreditsForGeneration(body.model, body.quality);

    // 5.6 提交时直接扣费（最终一致性：后续 poll/webhook 不再扣费）
    try {
      await consumeCredits({
        userId,
        amount: creditsCost,
        description: `Image generation submit: ${task.taskId}`,
      });
    } catch (creditError) {
      // 这里不返回 taskId/token，避免未扣费也能继续 poll 到结果（强制一致性）
      console.error('Error consuming credits on submit:', creditError);
      return NextResponse.json(
        {
          error:
            creditError instanceof Error
              ? creditError.message
              : 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
        },
        { status: 402 }
      );
    }

    // 6. 生成轮询 token（用 EvoLink 返回的真实 taskId）
    const pollToken = await generatePollToken(task.taskId, userId);

    // 7. 写入数据库
    const recordId = randomUUID();
    await db.insert(imageRecord).values({
      id: recordId,
      userId,
      type: 'generate',
      status: task.status, // 'pending' | 'processing'
      prompt: body.prompt,
      provider: EVOLINK_PROVIDER,
      model: body.model,
      taskId: task.taskId,
      isAsync: true,
      inputImageUrls: body.image_urls ? JSON.stringify(body.image_urls) : null,
      creditsUsed: creditsCost, // 提交时已扣费（根据模型和质量动态计算）
      isPublic: body.is_public, // 是否公开可见
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 8. 返回响应
    return NextResponse.json({
      taskId: task.taskId,
      token: pollToken,
      is_async: true,
      status: task.status,
    });
  } catch (error) {
    console.error('Error submitting image generation task:', error);

    const evolinkError = mapEvoLinkError(error);

    return NextResponse.json(
      {
        error: evolinkError.message,
        code: evolinkError.code,
      },
      { status: evolinkError.statusCode }
    );
  }
}
