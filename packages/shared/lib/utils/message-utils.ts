/**
 * 消息发送工具函数
 * 提供类型安全的消息发送和广播功能
 */

import {
  type BaseMessage,
  type BaseResponse,
  type BroadcastOptions,
  type BroadcastTarget,
  MessageType,
} from '../types/messages.js';

/**
 * 发送消息到扩展运行时
 * @param message 消息对象
 * @returns 响应结果
 */
export async function sendMessage<T = unknown, R = unknown>(
  message: BaseMessage<T>,
): Promise<BaseResponse<R>> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response as BaseResponse<R>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '发送消息失败',
    };
  }
}

/**
 * 发送消息到指定标签页的内容脚本
 * @param tabId 标签页 ID
 * @param message 消息对象
 * @returns 响应结果
 */
export async function sendMessageToTab<T = unknown, R = unknown>(
  tabId: number,
  message: BaseMessage<T>,
): Promise<BaseResponse<R>> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as BaseResponse<R>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '发送消息到标签页失败',
    };
  }
}

/**
 * 向多个目标广播消息
 * @param message 消息对象
 * @param options 广播选项
 */
export async function broadcastMessage<T = unknown>(
  message: BaseMessage<T>,
  options: BroadcastOptions = {},
): Promise<void> {
  const { targets = ['all'], excludeTabId, includeCurrentTab = true } = options;

  const shouldBroadcastTo = (target: BroadcastTarget): boolean => {
    if (targets.includes('all')) return true;
    return targets.includes(target);
  };

  // 获取当前标签页
  let currentTabId: number | undefined;
  if (includeCurrentTab) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTabId = tab?.id;
    } catch {
      // 忽略查询失败
    }
  }

  const promises: Promise<unknown>[] = [];

  // 广播到内容脚本（当前活跃标签页）
  if (shouldBroadcastTo('content') && currentTabId && currentTabId !== excludeTabId) {
    promises.push(
      sendMessageToTab(currentTabId, message).catch(error => {
        console.warn('[MessageUtils] 广播到内容脚本失败:', error);
      }),
    );
  }

  // 广播到 side panel
  if (shouldBroadcastTo('sidepanel')) {
    promises.push(
      sendMessage(message).catch(error => {
        console.warn('[MessageUtils] 广播到 Side Panel 失败:', error);
      }),
    );
  }

  // 广播到 popup
  if (shouldBroadcastTo('popup')) {
    promises.push(
      sendMessage(message).catch(error => {
        console.warn('[MessageUtils] 广播到 Popup 失败:', error);
      }),
    );
  }

  // 广播到 background
  if (shouldBroadcastTo('background')) {
    promises.push(
      sendMessage(message).catch(error => {
        console.warn('[MessageUtils] 广播到 Background 失败:', error);
      }),
    );
  }

  await Promise.all(promises);
}

/**
 * 发送智能匹配请求
 * @param currentUrl 当前页面 URL
 * @param currentTitle 当前页面标题
 */
export async function requestSmartMatch(
  currentUrl: string,
  currentTitle?: string,
): Promise<void> {
  await sendMessage({
    type: MessageType.SMART_MATCH_BACKLINK,
    payload: { currentUrl, currentTitle },
  });
}

/**
 * 发送 URL 变更通知
 * @param oldUrl 旧 URL
 * @param newUrl 新 URL
 * @param title 页面标题
 */
export async function notifyUrlChanged(
  oldUrl: string,
  newUrl: string,
  title?: string,
): Promise<void> {
  await sendMessage({
    type: MessageType.URL_CHANGED,
    payload: { oldUrl, newUrl, title },
  });
}

/**
 * 发送快速添加外链请求
 * @param url 外链 URL
 * @param domain 外链域名
 * @param options 可选参数
 */
export async function quickAddBacklink(
  url: string,
  domain: string,
  options?: {
    note?: string;
    keywords?: string[];
    groupId?: string;
  },
): Promise<BaseResponse<{ backlinkId: string }>> {
  return sendMessage({
    type: MessageType.QUICK_ADD_BACKLINK,
    payload: { url, domain, ...options },
  });
}

/**
 * 发送一键填充请求
 * @param profileId 网站资料 ID
 * @param options 可选参数
 */
export async function requestOneClickFill(
  profileId: string,
  options?: {
    backlinkId?: string;
    comment?: string;
    autoSubmit?: boolean;
  },
): Promise<BaseResponse<{ filledFields: string[] }>> {
  return sendMessage({
    type: MessageType.ONE_CLICK_FILL,
    payload: { profileId, ...options },
  });
}

/**
 * 打开悬浮面板
 * @param initialState 初始状态
 */
export async function openFloatingPanel(
  initialState: 'expanded' | 'collapsed' = 'collapsed',
): Promise<void> {
  await sendMessage({
    type: MessageType.OPEN_FLOATING_PANEL,
    payload: { initialState },
  });
}

/**
 * 关闭悬浮面板
 * @param reason 关闭原因
 */
export async function closeFloatingPanel(
  reason: 'user_action' | 'auto' | 'page_navigate' = 'user_action',
): Promise<void> {
  await sendMessage({
    type: MessageType.CLOSE_FLOATING_PANEL,
    payload: { reason },
  });
}

/**
 * 创建消息处理器包装器
 * 自动处理错误响应和日志记录
 */
export function createMessageHandler<T extends BaseMessage, R = unknown>(
  handler: (message: T, sender: chrome.runtime.MessageSender) => Promise<R> | R,
): (message: T, sender: chrome.runtime.MessageSender, sendResponse: (response: BaseResponse<R>) => void) => boolean {
  return (message, sender, sendResponse) => {
    (async () => {
      try {
        const result = await handler(message, sender);
        sendResponse({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error('[MessageUtils] 消息处理失败:', message.type, error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '消息处理失败',
        });
      }
    })();
    return true; // 异步响应
  };
}

/**
 * 检查消息类型
 * 用于类型守卫
 */
export function isMessageOfType<T extends BaseMessage>(
  message: unknown,
  type: MessageType,
): message is T {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as BaseMessage).type === type
  );
}
