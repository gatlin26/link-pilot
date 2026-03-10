/**
 * 轮询任务状态 API
 * GET /api/image-generation/poll?taskId=...&token=...
 *
 * 职责：
 * 1. 验证 token（包含 taskId + userId + exp）
 * 2. 直接查三方任务状态
 * 3. completed 时：下载结果 -> 上传 R2 -> 更新 DB -> 返回 output_url
 * 4. 其他状态：返回 status/progress/nextPollAfterMs
 */

import { getDb } from '@/db';
import { imageRecord } from '@/db/schema';
import { auth } from '@/lib/auth';
import {
  decodePollToken,
  downloadImageFromUrl,
  getExtensionFromContentType,
  getTaskDetail,
  mapEvoLinkError,
} from '@/services/image-providers/evolink';
import { uploadFile } from '@/storage';
import { and, eq, isNull } from 'drizzle-orm';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// ============================================================================
// 配置
// ============================================================================

/** 默认轮询间隔 */
const DEFAULT_POLL_INTERVAL_MS = 1500;

/** 生成结果文件夹 */
const OUTPUT_FOLDER = 'production';

// ============================================================================
// API Handler
// ============================================================================

export async function GET(req: NextRequest) {
  const db = await getDb();

  try {
    // 1. 验证登录
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = session.user.id;

    // 2. 获取查询参数
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const token = searchParams.get('token');

    if (!taskId || !token) {
      return NextResponse.json(
        { error: 'Missing taskId or token' },
        { status: 400 }
      );
    }

    // 3. 验证 token（解码并校验签名、过期时间）
    let tokenPayload: Awaited<ReturnType<typeof decodePollToken>>;
    try {
      tokenPayload = await decodePollToken(token);
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // 4. 校验 token 绑定的 taskId 和 userId
    if (tokenPayload.taskId !== taskId) {
      return NextResponse.json(
        { error: 'Token taskId mismatch' },
        { status: 403 }
      );
    }

    if (tokenPayload.userId !== currentUserId) {
      return NextResponse.json(
        { error: 'Token userId mismatch' },
        { status: 403 }
      );
    }

    // 5. 先检查 DB 是否已经 finalize（有 output_url）
    const existingRecords = await db
      .select({
        outputUrl: imageRecord.outputUrl,
        status: imageRecord.status,
        creditsUsed: imageRecord.creditsUsed,
      })
      .from(imageRecord)
      .where(eq(imageRecord.taskId, taskId))
      .limit(1);

    const existingRecord = existingRecords[0];

    // 如果已经有 output_url，直接返回（避免重复查三方和上传）
    if (existingRecord?.outputUrl) {
      return NextResponse.json({
        taskId,
        status: 'completed',
        output_url: existingRecord.outputUrl,
      });
    }

    // 6. 查三方任务状态
    const task = await getTaskDetail(taskId);

    // 7. 根据状态处理
    if (task.status === 'pending' || task.status === 'processing') {
      // 更新状态
      await db
        .update(imageRecord)
        .set({
          status: task.status,
          updatedAt: new Date(),
        })
        .where(eq(imageRecord.taskId, taskId));

      return NextResponse.json({
        taskId,
        status: task.status,
        nextPollAfterMs: DEFAULT_POLL_INTERVAL_MS,
      });
    }

    if (task.status === 'failed') {
      // 更新失败状态
      await db
        .update(imageRecord)
        .set({
          status: 'failed',
          errorMessage: task.error || 'Task failed',
          updatedAt: new Date(),
        })
        .where(eq(imageRecord.taskId, taskId));

      return NextResponse.json({
        taskId,
        status: 'failed',
        error: task.error || 'Task failed',
      });
    }

    if (task.status === 'completed') {
      // 8. Finalize：下载 -> 上传 R2 -> 更新 DB（扣费已在 submit 完成）
      const resultUrl = task.resultUrls?.[0];
      if (!resultUrl) {
        return NextResponse.json(
          { error: 'No result URL from provider' },
          { status: 500 }
        );
      }
      try {
        // 下载三方临时结果
        const { buffer, contentType } = await downloadImageFromUrl(resultUrl);

        // 生成固定 key（按 taskId，防止重复上传产生垃圾文件）
        const ext = getExtensionFromContentType(contentType);
        const filename = `${taskId}.${ext}`;

        // 上传到 R2
        const uploadResult = await uploadFile(
          buffer,
          filename,
          contentType,
          OUTPUT_FOLDER
        );

        // 更新 DB 为最终状态
        await db
          .update(imageRecord)
          .set({
            status: 'completed',
            outputUrl: uploadResult.url,
            updatedAt: new Date(),
          })
          .where(eq(imageRecord.taskId, taskId));

        return NextResponse.json({
          taskId,
          status: 'completed',
          output_url: uploadResult.url,
        });
      } catch (finalizeError) {
        console.error('Error finalizing task:', finalizeError);

        // finalize 失败（扣费已在 submit 发生；这里不回滚）
        await db
          .update(imageRecord)
          .set({
            status: 'failed',
            errorMessage:
              finalizeError instanceof Error
                ? finalizeError.message
                : 'Failed to finalize result',
            updatedAt: new Date(),
          })
          .where(eq(imageRecord.taskId, taskId));

        return NextResponse.json(
          { error: 'Failed to finalize result' },
          { status: 500 }
        );
      }
    }

    // 未知状态
    return NextResponse.json({
      taskId,
      status: task.status,
      nextPollAfterMs: DEFAULT_POLL_INTERVAL_MS,
    });
  } catch (error) {
    console.error('Error polling task:', error);

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
