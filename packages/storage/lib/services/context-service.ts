/**
 * 上下文服务实现
 */

import type { ContextService } from '@extension/shared/lib/interfaces/services.js';
import type { PageContext } from '@extension/shared/lib/types/models.js';
import { createStorage, StorageEnum } from '../base/index.js';

interface ContextStorageState {
  contexts: Record<string, PageContext>;
  lastCleanup: string;
}

const storage = createStorage<ContextStorageState>(
  'page-context-storage-key',
  {
    contexts: {},
    lastCleanup: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Session,
    liveUpdate: true,
    sessionAccessForContentScripts: true,
  },
);

export class ContextServiceImpl implements ContextService {
  /**
   * 保存页面上下文
   */
  async saveContext(context: PageContext): Promise<void> {
    const key = this.generateKey(context.domain, context.tab_id);
    const state = await storage.get();

    await storage.set({
      contexts: {
        ...state.contexts,
        [key]: context,
      },
      lastCleanup: state.lastCleanup,
    });
  }

  /**
   * 获取页面上下文
   */
  async getContext(url: string, tabId?: number): Promise<PageContext | null> {
    const domain = this.extractDomain(url);
    const key = this.generateKey(domain, tabId);
    const state = await storage.get();

    const context = state.contexts[key];
    if (!context) {
      return null;
    }

    // 检查是否过期（30 分钟）
    const createdAt = new Date(context.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;

    if (diffMinutes > 30) {
      // 过期，删除并返回 null
      await this.deleteContext(key);
      return null;
    }

    return context;
  }

  /**
   * 清理过期上下文
   */
  async cleanupExpired(): Promise<void> {
    const state = await storage.get();
    const now = new Date();
    const newContexts: Record<string, PageContext> = {};

    for (const [key, context] of Object.entries(state.contexts)) {
      const createdAt = new Date((context as PageContext).created_at);
      const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;

      // 保留未过期的上下文（30 分钟内）
      if (diffMinutes <= 30) {
        newContexts[key] = context as PageContext;
      }
    }

    await storage.set({
      contexts: newContexts,
      lastCleanup: now.toISOString(),
    });
  }

  /**
   * 删除上下文
   */
  private async deleteContext(key: string): Promise<void> {
    const state = await storage.get();
    const newContexts = { ...state.contexts };
    delete newContexts[key];

    await storage.set({
      contexts: newContexts,
      lastCleanup: state.lastCleanup,
    });
  }

  /**
   * 生成存储 key
   */
  private generateKey(domain: string, tabId?: number): string {
    if (tabId !== undefined) {
      return `${domain}:${tabId}`;
    }
    return domain;
  }

  /**
   * 从 URL 提取域名
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }
}

export const contextService = new ContextServiceImpl();
