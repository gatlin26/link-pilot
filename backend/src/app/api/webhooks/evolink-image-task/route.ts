/**
 * EvoLink 图像任务 Webhook
 * POST /api/webhooks/evolink-image-task?token=...
 *
 * 职责：
 * 1. 验证 webhook token
 * 2. 查 DB 定位记录并更新 status
 * 3. 立即返回 2xx（不做下载/上传 R2，重活交给轮询接口 finalize）
 */

import { getDb } from '@/db';
import { imageRecord } from '@/db/schema';
import { verifyWebhookToken } from '@/services/image-providers/evolink';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ============================================================================
// Webhook Payload 验证
// ============================================================================

const webhookPayloadSchema = z.object({
  task_id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  results: z.array(z.string()).optional(),
  error: z.string().optional(),
});

type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

// ============================================================================
// 状态优先级（只允许单向推进）
// ============================================================================

const STATUS_PRIORITY: Record<string, number> = {
  pending: 1,
  processing: 2,
  completed: 3,
  failed: 3, // completed 和 failed 同级，都是终态
};

function canTransition(currentStatus: string, newStatus: string): boolean {
  const currentPriority = STATUS_PRIORITY[currentStatus] || 0;
  const newPriority = STATUS_PRIORITY[newStatus] || 0;
  return newPriority >= currentPriority;
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(req: NextRequest) {
  const db = await getDb();

  try {
    // 1. 验证 webhook token
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      console.warn('[Webhook] Missing token');
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    try {
      await verifyWebhookToken(token);
    } catch (err) {
      console.warn('[Webhook] Invalid token:', err);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. 解析并验证请求体
    let payload: WebhookPayload;
    try {
      const rawBody = await req.json();
      payload = webhookPayloadSchema.parse(rawBody);
    } catch (error) {
      console.warn('[Webhook] Invalid payload:', error);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { task_id, status, error: taskError } = payload;

    console.log(`[Webhook] Received: taskId=${task_id}, status=${status}`);

    // 3. 查询现有记录
    const existingRecords = await db
      .select({
        id: imageRecord.id,
        status: imageRecord.status,
        outputUrl: imageRecord.outputUrl,
      })
      .from(imageRecord)
      .where(eq(imageRecord.taskId, task_id))
      .limit(1);

    const existingRecord = existingRecords[0];

    if (!existingRecord) {
      console.warn(`[Webhook] Record not found for taskId: ${task_id}`);
      // 即使找不到记录也返回 200，避免三方重试
      return NextResponse.json({ received: true });
    }

    // 4. 检查是否应该更新（状态单向推进）
    if (!canTransition(existingRecord.status, status)) {
      console.log(
        `[Webhook] Ignoring status transition: ${existingRecord.status} -> ${status}`
      );
      return NextResponse.json({ received: true });
    }

    // 5. 如果已经有 output_url（已 finalize），忽略更新
    if (existingRecord.outputUrl && status !== 'failed') {
      console.log('[Webhook] Record already finalized, ignoring update');
      return NextResponse.json({ received: true });
    }

    // 6. 更新记录
    const updateData: {
      status: string;
      errorMessage?: string;
      updatedAt: Date;
    } = {
      status,
      updatedAt: new Date(),
    };

    if (taskError) {
      updateData.errorMessage = taskError;
    }

    await db
      .update(imageRecord)
      .set(updateData)
      .where(eq(imageRecord.taskId, task_id));

    console.log(
      `[Webhook] Updated record: taskId=${task_id}, status=${status}`
    );

    // 7. 立即返回
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    // 即使出错也返回 200，避免三方无限重试
    return NextResponse.json({ received: true });
  }
}
