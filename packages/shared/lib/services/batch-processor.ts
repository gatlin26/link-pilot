/**
 * 批量处理服务实现
 */

import type { BatchProcessorService } from '../interfaces/services.js';
import type { Opportunity } from '../types/models.js';
import { SUBMISSION_RULES } from '../rules/business-rules.js';

interface ProcessingState {
  total: number;
  processed: number;
  failed: number;
  current: number;
  isPaused: boolean;
  isStopped: boolean;
}

export class BatchProcessorServiceImpl implements BatchProcessorService {
  private state: ProcessingState = {
    total: 0,
    processed: 0,
    failed: 0,
    current: 0,
    isPaused: false,
    isStopped: false,
  };

  private opportunities: Opportunity[] = [];
  private processingPromise: Promise<void> | null = null;

  /**
   * 批量打开页面
   */
  async openPages(opportunities: Opportunity[]): Promise<void> {
    if (this.processingPromise) {
      throw new Error('已有批量处理任务正在进行');
    }

    this.opportunities = opportunities;
    this.state = {
      total: opportunities.length,
      processed: 0,
      failed: 0,
      current: 0,
      isPaused: false,
      isStopped: false,
    };

    this.processingPromise = this.processQueue();
    await this.processingPromise;
    this.processingPromise = null;
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    for (let i = 0; i < this.opportunities.length; i++) {
      // 检查是否停止
      if (this.state.isStopped) {
        break;
      }

      // 检查是否暂停
      while (this.state.isPaused && !this.state.isStopped) {
        await this.sleep(1000);
      }

      this.state.current = i;
      const opportunity = this.opportunities[i];

      try {
        await this.processOpportunity(opportunity);
        this.state.processed++;
      } catch (error) {
        console.error(`处理机会失败: ${opportunity.id}`, error);
        this.state.failed++;
      }

      // 等待间隔时间
      if (i < this.opportunities.length - 1) {
        await this.sleep(SUBMISSION_RULES.batchProcessInterval);
      }
    }
  }

  /**
   * 处理单个机会
   */
  private async processOpportunity(opportunity: Opportunity): Promise<void> {
    // 发送消息到 background script 打开页面
    await chrome.runtime.sendMessage({
      type: 'OPEN_PAGE_WITH_CONTEXT',
      url: opportunity.url,
      context: {
        opportunity_id: opportunity.id,
        domain: opportunity.domain,
        link_type: opportunity.link_type,
        auto_fill_enabled: opportunity.can_auto_fill,
        auto_submit_enabled: opportunity.can_auto_submit,
      },
    });
  }

  /**
   * 获取处理进度
   */
  getProgress(): { total: number; processed: number; failed: number } {
    return {
      total: this.state.total,
      processed: this.state.processed,
      failed: this.state.failed,
    };
  }

  /**
   * 暂停处理
   */
  pause(): void {
    this.state.isPaused = true;
  }

  /**
   * 恢复处理
   */
  resume(): void {
    this.state.isPaused = false;
  }

  /**
   * 停止处理
   */
  stop(): void {
    this.state.isStopped = true;
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const batchProcessorService = new BatchProcessorServiceImpl();
