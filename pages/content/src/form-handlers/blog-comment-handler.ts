/**
 * 博客评论处理器
 * 负责检测博客评论页面并自动填充表单
 */

import { contextService } from '@extension/storage/lib/services/context-service';
import { formDetector, type FormDetectionResult } from './form-detector';
import { autoFillService } from './auto-fill-service';
import type { FillData, FillResult } from '@extension/shared';

/**
 * 博客评论处理器
 */
export class BlogCommentHandler {
  private detectionResult: FormDetectionResult | null = null;
  private initialized = false;

  /**
   * 初始化处理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 等待页面加载完成
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // 检测表单
      this.detectionResult = await formDetector.detect();

      if (this.detectionResult.detected) {
        console.log('检测到博客评论表单:', this.detectionResult);

        // 获取上下文
        const context = await this.getContext();

        // 如果有上下文且启用自动填充，则自动填充
        if (context && context.auto_fill_enabled) {
          await this.autoFill(context.auto_submit_enabled);
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('初始化博客评论处理器失败:', error);
    }
  }

  /**
   * 自动填充表单
   */
  async autoFill(autoSubmit = false): Promise<FillResult> {
    if (!this.detectionResult || !this.detectionResult.detected) {
      throw new Error('未检测到表单');
    }

    // 获取填充数据
    const data = await this.getFillData();

    // 填充表单
    const result = await autoFillService.fill(
      this.detectionResult.fields,
      data,
      autoSubmit
    );

    console.log('表单填充结果:', result);
    return result;
  }

  /**
   * 手动触发填充
   */
  async manualFill(data?: FillData, autoSubmit = false): Promise<FillResult> {
    // 如果没有检测结果，先检测
    if (!this.detectionResult) {
      this.detectionResult = await formDetector.detect();
    }

    if (!this.detectionResult.detected) {
      throw new Error('未检测到表单');
    }

    // 使用提供的数据或默认数据
    const fillData = data || await this.getFillData();

    // 填充表单
    return autoFillService.fill(
      this.detectionResult.fields,
      fillData,
      autoSubmit
    );
  }

  /**
   * 获取检测结果
   */
  getDetectionResult(): FormDetectionResult | null {
    return this.detectionResult;
  }

  /**
   * 重新检测表单
   */
  async redetect(): Promise<FormDetectionResult> {
    this.detectionResult = await formDetector.detect();
    return this.detectionResult;
  }

  /**
   * 获取上下文
   */
  private async getContext() {
    try {
      const tabId = chrome.tabs?.query
        ? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id
        : undefined;

      return await contextService.getContext(window.location.href, tabId);
    } catch (error) {
      console.error('获取上下文失败:', error);
      return await contextService.getContext(window.location.href);
    }
  }

  /**
   * 获取填充数据
   */
  private async getFillData(): Promise<FillData> {
    // 优先从上下文获取
    const context = await this.getContext();
    if (context) {
      // TODO: 从上下文或配置中获取用户的个人信息
      // 目前使用默认数据
    }

    // 从配置获取
    return autoFillService.getDataFromConfig();
  }
}

/**
 * 导出单例
 */
export const blogCommentHandler = new BlogCommentHandler();

/**
 * 自动初始化
 */
if (typeof window !== 'undefined') {
  // 页面加载时自动初始化
  blogCommentHandler.initialize().catch(error => {
    console.error('自动初始化失败:', error);
  });
}
