/**
 * 消息工具函数
 * 用于在扩展组件之间广播消息
 * @author gatlinyao
 * @date 2025-03-13
 */

import {
  MessageType,
  type BaseMessage,
  type BroadcastOptions,
} from '@extension/shared/lib/types/messages.js';

/**
 * 广播目标类型
 */
type BroadcastTarget = 'content' | 'sidepanel' | 'background' | 'all';

/**
 * 广播消息到指定目标
 * @param message 要广播的消息
 * @param options 广播选项
 */
export async function broadcastMessage<T extends BaseMessage>(
  message: T,
  options: BroadcastOptions = {},
): Promise<void> {
  const { targets = ['all'], excludeTabId, includeCurrentTab = true } = options;

  const promises: Promise<void>[] = [];

  // 广播到 content scripts
  if (targets.includes('all') || targets.includes('content')) {
    promises.push(broadcastToContentScripts(message, { excludeTabId, includeCurrentTab }));
  }

  // 广播到 sidepanel
  if (targets.includes('all') || targets.includes('sidepanel')) {
    promises.push(broadcastToSidePanel(message));
  }

  await Promise.all(promises);
}

/**
 * 广播消息到所有 content scripts
 * @param message 消息
 * @param options 选项
 */
async function broadcastToContentScripts<T extends BaseMessage>(
  message: T,
  options: { excludeTabId?: number; includeCurrentTab?: boolean } = {},
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      if (!tab.id) continue;
      if (tab.id === options.excludeTabId) continue;
      if (!options.includeCurrentTab && tab.active) continue;

      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch {
        // 忽略无法发送的 tab（可能没有 content script）
      }
    }
  } catch (error) {
    console.error('[MessageUtils] 广播到 content scripts 失败:', error);
  }
}

/**
 * 广播消息到 sidepanel
 * @param message 消息
 */
async function broadcastToSidePanel<T extends BaseMessage>(message: T): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      ...message,
      _target: 'sidepanel',
    });
  } catch (error) {
    console.error('[MessageUtils] 广播到 sidepanel 失败:', error);
  }
}

/**
 * 发送匹配结果更新
 * 专用函数，简化调用
 * @param matchData 匹配数据
 */
export async function sendMatchResultUpdate(matchData: {
  bestMatch: unknown;
  confidence: number;
  alternatives: unknown[];
  sourceUrl: string;
  timestamp: number;
}): Promise<void> {
  const message = {
    type: MessageType.MATCH_RESULT_UPDATED,
    payload: {
      ...matchData,
    },
  };

  await broadcastMessage(message, { targets: ['sidepanel', 'content'] });
}

/**
 * 请求智能匹配
 * 从扩展 UI 调用
 * @param url 要匹配的 URL（可选，默认为当前页面）
 */
export async function requestSmartMatch(url?: string): Promise<{
  success: boolean;
  data?: { matches: unknown[]; count: number };
  error?: string;
}> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.SMART_MATCH_BACKLINK,
      payload: url ? { currentUrl: url } : undefined,
    });

    return response;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '请求失败',
    };
  }
}
