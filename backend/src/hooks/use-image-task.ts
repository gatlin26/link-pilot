/**
 * @file use-image-task.ts
 * @description 图片生成任务 Hook - 封装 submit → poll 异步流程
 * @author AI Assistant
 * @date 2025-12-25
 */

'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

export type TaskStatus =
  | 'idle'
  | 'submitting'
  | 'polling'
  | 'completed'
  | 'failed';

export interface ImageTaskState {
  /** 当前状态 */
  status: TaskStatus;
  /** 任务 ID（EvoLink 返回） */
  taskId: string | null;
  /** 轮询 token */
  token: string | null;
  /** 生成结果 URL */
  outputUrl: string | null;
  /** 错误信息 */
  error: string | null;
  /** 进度提示 */
  message: string;
  /** 任务耗时（毫秒） */
  elapsed: number | null;
}

export interface SubmitParams {
  /** 提示词 */
  prompt: string;
  /** 模型 ID */
  model: string;
  /** 宽高比 */
  size: string;
  /** 图片质量 ('1K' | '2K' | '4K') */
  quality?: string;
  /** 输入图片 URLs（已上传到 R2） */
  imageUrls?: string[];
  /** 是否公开可见（用于 Gallery 展示） */
  isPublic?: boolean;
}

interface SubmitResponse {
  taskId: string;
  token: string;
  is_async: boolean;
  status: string;
  output_url?: string; // 同步模式预留
  error?: string;
}

interface PollResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  output_url?: string;
  nextPollAfterMs?: number;
  error?: string;
}

// ============================================================================
// 配置
// ============================================================================

/** 默认轮询间隔 */
const DEFAULT_POLL_INTERVAL = 1500;

/** 最大轮询次数（防止无限轮询） */
const MAX_POLL_ATTEMPTS = 120; // 约 3 分钟

// ============================================================================
// Hook 实现
// ============================================================================

export function useImageTask() {
  const t = useTranslations('ImageTask');

  const [state, setState] = useState<ImageTaskState>({
    status: 'idle',
    taskId: null,
    token: null,
    outputUrl: null,
    error: null,
    message: '',
    elapsed: null,
  });

  // 轮询控制
  const abortControllerRef = useRef<AbortController | null>(null);

  // 任务开始时间（用于计算耗时）
  const startTimeRef = useRef<number | null>(null);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    // 取消进行中的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 重置开始时间
    startTimeRef.current = null;

    setState({
      status: 'idle',
      taskId: null,
      token: null,
      outputUrl: null,
      error: null,
      message: '',
      elapsed: null,
    });
  }, []);

  /**
   * 轮询任务状态（使用循环而非递归）
   */
  const pollTask = useCallback(
    async (taskId: string, token: string): Promise<void> => {
      let pollCount = 0;

      while (pollCount < MAX_POLL_ATTEMPTS) {
        pollCount += 1;

        // 检查是否已被取消
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        try {
          const response = await fetch(
            `/api/image-generation/poll?taskId=${encodeURIComponent(taskId)}&token=${encodeURIComponent(token)}`,
            { signal: abortControllerRef.current?.signal }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.error || t('requestFailed', { status: response.status })
            );
          }

          const data: PollResponse = await response.json();

          if (data.status === 'completed' && data.output_url) {
            // 生成成功，计算耗时
            const elapsed = startTimeRef.current
              ? Date.now() - startTimeRef.current
              : null;
            setState((prev) => ({
              ...prev,
              status: 'completed',
              outputUrl: data.output_url!,
              message: t('completed'),
              elapsed,
            }));
            return;
          }

          if (data.status === 'failed') {
            // 生成失败
            setState((prev) => ({
              ...prev,
              status: 'failed',
              error: data.error || t('generationFailed'),
              message: '',
            }));
            return;
          }

          // 继续轮询
          setState((prev) => ({
            ...prev,
            message:
              data.status === 'processing' ? t('generating') : t('queuing'),
          }));

          const pollInterval = data.nextPollAfterMs || DEFAULT_POLL_INTERVAL;

          // 等待下次轮询
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(resolve, pollInterval);

            // 监听取消信号
            abortControllerRef.current?.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timeoutId);
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true }
            );
          });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            // 用户取消，不处理
            return;
          }

          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: error instanceof Error ? error.message : t('networkError'),
            message: '',
          }));
          return;
        }
      }

      // 超过最大轮询次数
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: t('timeout'),
        message: '',
      }));
    },
    [t]
  );

  /**
   * 提交生成任务
   */
  const submit = useCallback(
    async (params: SubmitParams): Promise<boolean> => {
      // 重置状态
      reset();

      // 记录开始时间
      startTimeRef.current = Date.now();

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();

      setState({
        status: 'submitting',
        taskId: null,
        token: null,
        outputUrl: null,
        error: null,
        message: t('submitting'),
        elapsed: null,
      });

      try {
        const response = await fetch('/api/image-generation/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: params.prompt,
            model: params.model,
            size: params.size,
            quality: params.quality,
            image_urls: params.imageUrls,
            is_public: params.isPublic ?? true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || t('submitFailed', { status: response.status })
          );
        }

        const data: SubmitResponse = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // 同步模式（预留）
        if (!data.is_async && data.output_url) {
          const elapsed = startTimeRef.current
            ? Date.now() - startTimeRef.current
            : null;
          setState({
            status: 'completed',
            taskId: data.taskId,
            token: data.token,
            outputUrl: data.output_url,
            error: null,
            message: t('completed'),
            elapsed,
          });
          return true;
        }

        // 异步模式 - 开始轮询
        setState({
          status: 'polling',
          taskId: data.taskId,
          token: data.token,
          outputUrl: null,
          error: null,
          message: t('submitted'),
          elapsed: null,
        });

        // 开始轮询
        await pollTask(data.taskId, data.token);

        return true;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return false;
        }

        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: error instanceof Error ? error.message : t('submitError'),
          message: '',
        }));

        return false;
      }
    },
    [reset, pollTask, t]
  );

  /**
   * 取消任务
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      status: 'idle',
      message: t('cancelled'),
    }));
  }, [t]);

  return {
    ...state,
    /** 是否正在处理中 */
    isProcessing: ['submitting', 'polling'].includes(state.status),
    /** 提交任务 */
    submit,
    /** 取消任务 */
    cancel,
    /** 重置状态 */
    reset,
  };
}
