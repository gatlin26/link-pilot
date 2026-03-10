/**
 * 递归采集管理器
 * 负责管理递归外链采集的整体流程
 */

import { collectionManager, CollectionCallbacks } from './collection-manager';
import { messageRouter } from './message-router';
import { recursiveQueueStorage, recursiveConfigStorage, opportunityStorage } from '@extension/storage';
import { businessTypeDetectorService } from '@extension/shared';
import type {
  RecursiveQueueItem,
  RecursiveCollectionSession,
  CollectedBacklink,
  RecursiveCollectionStats,
} from '@extension/shared';
import {
  RecursiveQueueStatus,
  RecursiveSessionStatus,
  RecursiveStrategy,
  DeduplicationStrategy,
} from '@extension/shared';

/**
 * 递归采集管理器类
 */
class RecursiveCollectionManager {
  private isRunning = false;
  private isPaused = false;
  private currentItemId: string | null = null;
  private collectionTabId: number | null = null; // 保持会话的标签页
  private waitingForVerification = false; // 是否正在等待验证

  /**
   * 初始化管理器
   */
  init(): void {
    console.log('[Recursive Collection Manager] 初始化');
    // 启动时检查是否有未完成的会话
    this.checkAndRecoverSession().catch(error => {
      console.error('[Recursive Collection Manager] 恢复会话失败:', error);
    });
  }

  /**
   * 检查并恢复未完成的会话
   */
  private async checkAndRecoverSession(): Promise<void> {
    const session = await recursiveConfigStorage.getCurrentSession();
    if (!session) return;

    // 如果会话状态是 RUNNING，说明上次异常退出，重置为 PAUSED
    if (session.status === RecursiveSessionStatus.RUNNING) {
      console.log('[Recursive Collection Manager] 检测到未完成的会话，重置为暂停状态');
      await recursiveConfigStorage.updateSession({
        status: RecursiveSessionStatus.PAUSED,
      });
      // 重置所有 IN_PROGRESS 状态为 PENDING
      await recursiveQueueStorage.resetInProgress();
    }
  }

  /**
   * 启动递归采集
   */
  async startRecursiveCollection(
    initialUrl: string,
    maxDepth?: number,
    maxLinksPerUrl?: number,
    targetGroupId?: string,
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      // 检查是否已有活动会话
      const existingSession = await recursiveConfigStorage.getCurrentSession();
      if (existingSession && existingSession.status === RecursiveSessionStatus.RUNNING) {
        return {
          success: false,
          error: '已有活动的递归采集会话',
        };
      }

      // 获取默认配置
      const config = await recursiveConfigStorage.getDefaultConfig();

      // 应用用户参数
      if (maxDepth !== undefined) {
        config.max_depth = maxDepth;
      }
      if (maxLinksPerUrl !== undefined) {
        config.max_links_per_url = maxLinksPerUrl;
      }
      if (targetGroupId) {
        config.target_group_id = targetGroupId;
      }

      // 创建新会话
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();
      const session: RecursiveCollectionSession = {
        id: sessionId,
        initial_url: initialUrl,
        strategy: RecursiveStrategy.BREADTH_FIRST,
        max_depth: config.max_depth,
        max_links_per_url: config.max_links_per_url,
        status: RecursiveSessionStatus.INITIALIZED,
        config,
        stats: this.createEmptyStats(),
        created_at: now,
        updated_at: now,
      };

      await recursiveConfigStorage.createSession(session);

      // 清空队列
      await recursiveQueueStorage.clear();

      // 将初始 URL 加入队列
      const domain = this.extractDomain(initialUrl);
      if (!domain) {
        return {
          success: false,
          error: '无效的 URL',
        };
      }

      const initialItem: RecursiveQueueItem = {
        id: crypto.randomUUID(),
        url: initialUrl,
        domain,
        depth: 0,
        parent_id: null,
        status: RecursiveQueueStatus.PENDING,
        retry_count: 0,
        created_at: now,
        updated_at: now,
      };

      await recursiveQueueStorage.enqueue(initialItem);

      // 更新会话状态和统计
      await recursiveConfigStorage.updateSession({
        status: RecursiveSessionStatus.RUNNING,
        started_at: now,
      });

      await this.updateStats({
        total_urls: 1,
        pending_count: 1,
      });

      // 启动采集循环
      this.isRunning = true;
      this.isPaused = false;
      this.collectionLoop().catch(error => {
        console.error('[Recursive Collection Manager] 采集循环异常:', error);
      });

      return {
        success: true,
        sessionId,
      };
    } catch (error) {
      console.error('[Recursive Collection Manager] 启动递归采集失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '启动失败',
      };
    }
  }

  /**
   * 核心采集循环
   */
  private async collectionLoop(): Promise<void> {
    console.log('[Recursive Collection Manager] 采集循环开始');

    while (this.isRunning && !this.isPaused) {
      try {
        // 获取下一个待处理项
        const nextItem = await recursiveQueueStorage.getNext();

        if (!nextItem) {
          console.log('[Recursive Collection Manager] 队列为空，采集完成');
          await this.completeSession();
          break;
        }

        // 检查限制条件
        const session = await recursiveConfigStorage.getCurrentSession();
        if (!session) {
          console.error('[Recursive Collection Manager] 会话不存在');
          break;
        }

        // 检查深度限制
        if (nextItem.depth >= session.config.max_depth) {
          console.log('[Recursive Collection Manager] 达到最大深度限制，自动暂停');
          await this.pauseCollection('达到最大深度限制');
          break;
        }

        // 检查总数限制
        if (session.stats.total_urls >= session.config.max_total_urls) {
          console.log('[Recursive Collection Manager] 达到总URL数量限制，自动暂停');
          await this.pauseCollection('达到总URL数量限制');
          break;
        }

        // 处理当前项
        await this.processQueueItem(nextItem, session);

        // 方案 2：增加随机延迟（在基础间隔上增加 0-5 秒的随机延迟）
        const randomDelay = Math.floor(Math.random() * 5000);
        const totalDelay = session.config.collection_interval_ms + randomDelay;
        console.log('[Recursive Collection Manager] 等待', totalDelay, 'ms 后继续');
        await this.sleep(totalDelay);
      } catch (error) {
        console.error('[Recursive Collection Manager] 采集循环错误:', error);
        // 继续下一个
      }
    }

    console.log('[Recursive Collection Manager] 采集循环结束');
  }

  /**
   * 处理队列项
   */
  private async processQueueItem(
    item: RecursiveQueueItem,
    session: RecursiveCollectionSession,
  ): Promise<void> {
    console.log('[Recursive Collection Manager] 处理队列项:', item.url, '深度:', item.depth);

    this.currentItemId = item.id;

    // 更新状态为 IN_PROGRESS
    await recursiveQueueStorage.updateItem(item.id, {
      status: RecursiveQueueStatus.IN_PROGRESS,
      started_at: new Date().toISOString(),
    });

    await this.updateStats({
      in_progress_count: session.stats.in_progress_count + 1,
      pending_count: session.stats.pending_count - 1,
    });

    try {
      // 方案 1：检测验证页面
      if (this.collectionTabId) {
        const verificationCheck = await this.checkVerificationPage(this.collectionTabId);
        if (verificationCheck.isVerification) {
          console.log('[Recursive Collection Manager] 检测到验证页面:', verificationCheck.message);
          this.waitingForVerification = true;
          await this.pauseCollection(`检测到验证页面: ${verificationCheck.message}`);

          // 通知用户需要完成验证
          await this.notifyVerificationRequired(verificationCheck);

          // 恢复队列项状态为 PENDING
          await recursiveQueueStorage.updateItem(item.id, {
            status: RecursiveQueueStatus.PENDING,
          });

          await this.updateStats({
            in_progress_count: session.stats.in_progress_count - 1,
            pending_count: session.stats.pending_count + 1,
          });

          return;
        }
      }

      // 调用 CollectionManager 执行单次采集
      const callbacks: CollectionCallbacks = {
        onCollectionStart: (targetUrl: string) => {
          console.log('[Recursive Collection Manager] 开始采集:', targetUrl);
        },
        onCollectionComplete: async result => {
          console.log('[Recursive Collection Manager] 采集完成:', result);
          // 提取并入队新 URL
          if (result.count && result.count > 0) {
            await this.extractAndEnqueueUrls(item, session);
          }
        },
        onCollectionError: error => {
          console.error('[Recursive Collection Manager] 采集错误:', error);
        },
      };

      const result = await collectionManager.startManualCollection(
        item.url,
        session.config.max_links_per_url,
        session.config.target_group_id,
        undefined,
        callbacks,
        this.collectionTabId || undefined, // 方案 3：复用标签页
      );

      // 保存标签页 ID 以供后续复用
      if (result.success && !this.collectionTabId) {
        // 获取当前活动标签页（假设是刚创建的采集标签页）
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].id) {
          this.collectionTabId = tabs[0].id;
          console.log('[Recursive Collection Manager] 保存标签页 ID 以供复用:', this.collectionTabId);
        }
      }

      if (result.success) {
        // 更新队列项状态为 COMPLETED
        await recursiveQueueStorage.updateItem(item.id, {
          status: RecursiveQueueStatus.COMPLETED,
          collected_count: result.count || 0,
          completed_at: new Date().toISOString(),
        });

        await this.updateStats({
          in_progress_count: session.stats.in_progress_count - 1,
          completed_count: session.stats.completed_count + 1,
          total_backlinks_collected: session.stats.total_backlinks_collected + (result.count || 0),
          total_backlinks_added: session.stats.total_backlinks_added + (result.addedToLibrary || 0),
        });

        // 更新深度统计
        await this.updateDepthStats(item.depth, 'completed');
      } else {
        // 检查是否需要重试
        if (item.retry_count < session.config.max_retries) {
          console.log('[Recursive Collection Manager] 采集失败，准备重试:', item.url);
          await recursiveQueueStorage.updateItem(item.id, {
            status: RecursiveQueueStatus.PENDING,
            retry_count: item.retry_count + 1,
            error_message: result.error,
          });

          await this.updateStats({
            in_progress_count: session.stats.in_progress_count - 1,
            pending_count: session.stats.pending_count + 1,
          });
        } else {
          console.log('[Recursive Collection Manager] 采集失败，超过重试次数:', item.url);
          await recursiveQueueStorage.updateItem(item.id, {
            status: RecursiveQueueStatus.FAILED,
            error_message: result.error,
            completed_at: new Date().toISOString(),
          });

          await this.updateStats({
            in_progress_count: session.stats.in_progress_count - 1,
            failed_count: session.stats.failed_count + 1,
          });

          await this.updateDepthStats(item.depth, 'failed');
        }
      }
    } catch (error) {
      console.error('[Recursive Collection Manager] 处理队列项异常:', error);
      await recursiveQueueStorage.updateItem(item.id, {
        status: RecursiveQueueStatus.FAILED,
        error_message: error instanceof Error ? error.message : '处理失败',
        completed_at: new Date().toISOString(),
      });

      await this.updateStats({
        in_progress_count: session.stats.in_progress_count - 1,
        failed_count: session.stats.failed_count + 1,
      });
    } finally {
      this.currentItemId = null;
    }
  }

  /**
   * 提取并入队新 URL
   */
  private async extractAndEnqueueUrls(
    parentItem: RecursiveQueueItem,
    session: RecursiveCollectionSession,
  ): Promise<void> {
    try {
      console.log('[Recursive Collection Manager] 开始提取新 URL，父项:', parentItem.url);

      // 从 opportunityStorage 获取最近采集的外链
      // 由于 CollectionManager 会保存所有外链，我们需要筛选出属于当前父项的外链
      const allOpportunities = await opportunityStorage.getAll();

      // 获取最近添加的外链（假设是刚采集的）
      // 按创建时间排序，取最新的 max_links_per_url 条
      const recentOpportunities = allOpportunities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, session.config.max_links_per_url);

      console.log('[Recursive Collection Manager] 找到最近的外链数量:', recentOpportunities.length);

      // 提取唯一的域名
      const uniqueDomains = new Set<string>();
      const domainToUrl = new Map<string, string>();

      for (const opportunity of recentOpportunities) {
        const domain = opportunity.domain;
        const url = opportunity.url;

        // 构建完整的 URL（如果需要）
        let fullUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          fullUrl = `https://${domain}`;
        }

        uniqueDomains.add(domain);
        if (!domainToUrl.has(domain)) {
          domainToUrl.set(domain, fullUrl);
        }
      }

      console.log('[Recursive Collection Manager] 提取到唯一域名数量:', uniqueDomains.size);

      // 入队新 URL
      let enqueuedCount = 0;
      const nextDepth = parentItem.depth + 1;

      for (const domain of uniqueDomains) {
        const url = domainToUrl.get(domain);
        if (!url) continue;

        // 应用去重策略
        const isDuplicate = await this.applyDeduplication(url, domain, session);
        if (isDuplicate) {
          console.log('[Recursive Collection Manager] URL 已存在，跳过:', url);
          continue;
        }

        // 应用过滤规则
        const shouldFilter = await this.shouldFilterUrl(url, domain);
        if (shouldFilter) {
          console.log('[Recursive Collection Manager] URL 被过滤，跳过:', url);
          continue;
        }

        // 创建新的队列项
        const now = new Date().toISOString();
        const newItem: RecursiveQueueItem = {
          id: crypto.randomUUID(),
          url,
          domain,
          depth: nextDepth,
          parent_id: parentItem.id,
          status: RecursiveQueueStatus.PENDING,
          retry_count: 0,
          created_at: now,
          updated_at: now,
        };

        await recursiveQueueStorage.enqueue(newItem);
        enqueuedCount++;

        console.log('[Recursive Collection Manager] 入队新 URL:', url, '深度:', nextDepth);
      }

      // 更新统计
      await this.updateStats({
        total_urls: session.stats.total_urls + enqueuedCount,
        pending_count: session.stats.pending_count + enqueuedCount,
      });

      // 更新深度统计
      if (enqueuedCount > 0) {
        await this.updateDepthStats(nextDepth, 'pending', enqueuedCount);
      }

      console.log('[Recursive Collection Manager] 提取完成，入队数量:', enqueuedCount);
    } catch (error) {
      console.error('[Recursive Collection Manager] 提取并入队新 URL 失败:', error);
    }
  }

  /**
   * 应用去重策略
   */
  private async applyDeduplication(url: string, domain: string, session: RecursiveCollectionSession): Promise<boolean> {
    const config = session.config;

    if (config.deduplication === DeduplicationStrategy.URL_LEVEL) {
      return await recursiveQueueStorage.hasUrl(url);
    }

    if (config.deduplication === DeduplicationStrategy.DOMAIN_LEVEL) {
      return await recursiveQueueStorage.hasDomain(domain);
    }

    // HYBRID：根据站点类型动态选择
    const filters = await recursiveConfigStorage.getEnabledSiteFilters();
    const businessTypes = businessTypeDetectorService.detect(url, '', '');

    for (const filter of filters) {
      if (filter.business_types?.some(type => businessTypes.includes(type))) {
        // 匹配过滤规则，使用规则指定的去重级别
        if (filter.deduplication_level === 'domain') {
          return await recursiveQueueStorage.hasDomain(domain);
        }
      }
    }

    // 默认 URL 级别去重
    return await recursiveQueueStorage.hasUrl(url);
  }

  /**
   * 检查是否应该过滤 URL
   */
  private async shouldFilterUrl(url: string, domain: string): Promise<boolean> {
    const filters = await recursiveConfigStorage.getEnabledSiteFilters();

    // 使用现有的业务类型检测服务
    const businessTypes = businessTypeDetectorService.detect(url, '', '');

    for (const filter of filters) {
      if (filter.business_types?.some(type => businessTypes.includes(type))) {
        return true; // 匹配过滤规则
      }

      if (filter.domain_patterns?.some(pattern => new RegExp(pattern).test(domain))) {
        return true;
      }
    }

    return false;
  }

  /**
   * 暂停采集
   */
  async pauseCollection(reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isRunning) {
        return {
          success: false,
          error: '没有正在运行的采集',
        };
      }

      this.isPaused = true;

      await recursiveConfigStorage.updateSession({
        status: RecursiveSessionStatus.PAUSED,
        paused_at: new Date().toISOString(),
      });

      console.log('[Recursive Collection Manager] 采集已暂停', reason ? `原因: ${reason}` : '');

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Recursive Collection Manager] 暂停采集失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '暂停失败',
      };
    }
  }

  /**
   * 恢复采集
   */
  async resumeCollection(): Promise<{ success: boolean; error?: string }> {
    try {
      const session = await recursiveConfigStorage.getCurrentSession();
      if (!session) {
        return {
          success: false,
          error: '没有活动的会话',
        };
      }

      if (session.status !== RecursiveSessionStatus.PAUSED) {
        return {
          success: false,
          error: '会话未处于暂停状态',
        };
      }

      this.isPaused = false;
      this.isRunning = true;

      await recursiveConfigStorage.updateSession({
        status: RecursiveSessionStatus.RUNNING,
      });

      // 重启采集循环
      this.collectionLoop().catch(error => {
        console.error('[Recursive Collection Manager] 采集循环异常:', error);
      });

      console.log('[Recursive Collection Manager] 采集已恢复');

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Recursive Collection Manager] 恢复采集失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '恢复失败',
      };
    }
  }

  /**
   * 停止采集
   */
  async stopCollection(): Promise<{ success: boolean; error?: string }> {
    try {
      this.isRunning = false;
      this.isPaused = false;

      await recursiveConfigStorage.updateSession({
        status: RecursiveSessionStatus.STOPPED,
        completed_at: new Date().toISOString(),
      });

      console.log('[Recursive Collection Manager] 采集已停止');

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Recursive Collection Manager] 停止采集失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '停止失败',
      };
    }
  }

  /**
   * 完成会话
   */
  private async completeSession(): Promise<void> {
    this.isRunning = false;
    this.isPaused = false;

    await recursiveConfigStorage.updateSession({
      status: RecursiveSessionStatus.COMPLETED,
      completed_at: new Date().toISOString(),
    });

    console.log('[Recursive Collection Manager] 会话已完成');
  }

  /**
   * 获取当前状态
   */
  async getStatus(): Promise<{
    session: RecursiveCollectionSession | null;
    queueSize: number;
    currentItem: RecursiveQueueItem | null;
  }> {
    const session = await recursiveConfigStorage.getCurrentSession();
    const allItems = await recursiveQueueStorage.getAll();
    const currentItem = this.currentItemId ? await recursiveQueueStorage.getById(this.currentItemId) : null;

    return {
      session,
      queueSize: allItems.length,
      currentItem,
    };
  }

  /**
   * 创建空统计信息
   */
  private createEmptyStats(): RecursiveCollectionStats {
    return {
      total_urls: 0,
      pending_count: 0,
      in_progress_count: 0,
      completed_count: 0,
      failed_count: 0,
      skipped_count: 0,
      total_backlinks_collected: 0,
      total_backlinks_added: 0,
      current_depth: 0,
      max_depth_reached: 0,
      by_depth: {},
    };
  }

  /**
   * 更新统计信息
   */
  private async updateStats(updates: Partial<RecursiveCollectionStats>): Promise<void> {
    const session = await recursiveConfigStorage.getCurrentSession();
    if (!session) return;

    await recursiveConfigStorage.updateSession({
      stats: {
        ...session.stats,
        ...updates,
      },
    });
  }

  /**
   * 更新深度统计
   */
  private async updateDepthStats(
    depth: number,
    status: 'pending' | 'completed' | 'failed',
    count: number = 1,
  ): Promise<void> {
    const session = await recursiveConfigStorage.getCurrentSession();
    if (!session) return;

    const byDepth = { ...session.stats.by_depth };
    if (!byDepth[depth]) {
      byDepth[depth] = { total: 0, completed: 0, failed: 0 };
    }

    if (status === 'pending') {
      byDepth[depth].total += count;
    } else if (status === 'completed') {
      byDepth[depth].completed += count;
    } else {
      byDepth[depth].failed += count;
    }

    await recursiveConfigStorage.updateSession({
      stats: {
        ...session.stats,
        by_depth: byDepth,
        max_depth_reached: Math.max(session.stats.max_depth_reached, depth),
      },
    });
  }

  /**
   * 提取域名
   */
  private extractDomain(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检测验证页面
   */
  private async checkVerificationPage(
    tabId: number,
  ): Promise<{ isVerification: boolean; type?: string; message?: string }> {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: 'CHECK_VERIFICATION_PAGE',
      })) as { success?: boolean; data?: { isVerification: boolean; type?: string; message?: string } };

      if (response?.success && response.data) {
        return response.data;
      }

      return { isVerification: false };
    } catch (error) {
      console.error('[Recursive Collection Manager] 检测验证页面失败:', error);
      return { isVerification: false };
    }
  }

  /**
   * 通知用户需要完成验证
   */
  private async notifyVerificationRequired(verificationInfo: {
    isVerification: boolean;
    type?: string;
    message?: string;
  }): Promise<void> {
    try {
      // 创建通知
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon/128.png',
        title: '需要完成验证',
        message: verificationInfo.message || '检测到验证页面，请完成验证后点击"恢复采集"继续',
        priority: 2,
      });
    } catch (error) {
      console.error('[Recursive Collection Manager] 创建通知失败:', error);
    }
  }

  /**
   * 等待验证完成
   */
  async waitForVerificationComplete(timeoutMs: number = 300000): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.collectionTabId) {
        return {
          success: false,
          error: '没有活动的采集标签页',
        };
      }

      const response = (await chrome.tabs.sendMessage(this.collectionTabId, {
        type: 'WAIT_FOR_VERIFICATION',
        payload: { timeoutMs },
      })) as { success?: boolean; data?: { completed: boolean }; error?: string };

      if (response?.success && response.data?.completed) {
        this.waitingForVerification = false;
        return { success: true };
      }

      return {
        success: false,
        error: response?.error || '等待验证失败',
      };
    } catch (error) {
      console.error('[Recursive Collection Manager] 等待验证失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '等待验证失败',
      };
    }
  }
}

// 创建并初始化管理器实例
export const recursiveCollectionManager = new RecursiveCollectionManager();
recursiveCollectionManager.init();

// 注册消息处理器
messageRouter.register('START_RECURSIVE_COLLECTION', (message, sender, sendResponse) => {
  const { initialUrl, maxDepth, maxLinksPerUrl, targetGroupId } = message.payload ?? {};

  if (typeof initialUrl !== 'string' || !initialUrl.trim()) {
    sendResponse({
      success: false,
      error: '缺少 initialUrl',
    });
    return false;
  }

  console.log('[Recursive Collection Manager] 开始递归采集:', initialUrl);

  recursiveCollectionManager
    .startRecursiveCollection(initialUrl, maxDepth, maxLinksPerUrl, targetGroupId)
    .then(result => {
      console.log('[Recursive Collection Manager] 递归采集启动结果:', result);
      sendResponse(result);
    })
    .catch(error => {
      console.error('[Recursive Collection Manager] 递归采集启动失败:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '启动失败',
      });
    });

  return true; // 异步响应
});

messageRouter.register('PAUSE_RECURSIVE_COLLECTION', (message, sender, sendResponse) => {
  console.log('[Recursive Collection Manager] 暂停递归采集');

  recursiveCollectionManager
    .pauseCollection()
    .then(result => {
      console.log('[Recursive Collection Manager] 暂停结果:', result);
      sendResponse(result);
    })
    .catch(error => {
      console.error('[Recursive Collection Manager] 暂停失败:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '暂停失败',
      });
    });

  return true;
});

messageRouter.register('RESUME_RECURSIVE_COLLECTION', (message, sender, sendResponse) => {
  console.log('[Recursive Collection Manager] 恢复递归采集');

  recursiveCollectionManager
    .resumeCollection()
    .then(result => {
      console.log('[Recursive Collection Manager] 恢复结果:', result);
      sendResponse(result);
    })
    .catch(error => {
      console.error('[Recursive Collection Manager] 恢复失败:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '恢复失败',
      });
    });

  return true;
});

messageRouter.register('STOP_RECURSIVE_COLLECTION', (message, sender, sendResponse) => {
  console.log('[Recursive Collection Manager] 停止递归采集');

  recursiveCollectionManager
    .stopCollection()
    .then(result => {
      console.log('[Recursive Collection Manager] 停止结果:', result);
      sendResponse(result);
    })
    .catch(error => {
      console.error('[Recursive Collection Manager] 停止失败:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '停止失败',
      });
    });

  return true;
});

messageRouter.register('GET_RECURSIVE_STATUS', (message, sender, sendResponse) => {
  recursiveCollectionManager
    .getStatus()
    .then(status => {
      sendResponse({
        success: true,
        ...status,
      });
    })
    .catch(error => {
      console.error('[Recursive Collection Manager] 获取状态失败:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '获取状态失败',
      });
    });

  return true;
});

messageRouter.register('WAIT_FOR_VERIFICATION_COMPLETE', (message, sender, sendResponse) => {
  const { timeoutMs } = message.payload ?? {};

  recursiveCollectionManager
    .waitForVerificationComplete(timeoutMs)
    .then(result => {
      sendResponse(result);
    })
    .catch(error => {
      console.error('[Recursive Collection Manager] 等待验证失败:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '等待验证失败',
      });
    });

  return true;
});

console.log('[Recursive Collection Manager] Recursive collection manager loaded');
