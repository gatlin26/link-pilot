/**
 * 上下文管理器（Background Script）
 */

import { contextService } from '@extension/storage/lib/services/context-service';
import type { PageContext } from '@extension/shared/lib/types/models';

/**
 * 打开页面并保存上下文
 */
export async function openPageWithContext(
  url: string,
  context: Omit<PageContext, 'created_at'>,
): Promise<void> {
  // 创建新标签页
  const tab = await chrome.tabs.create({ url, active: true });

  if (!tab.id) {
    throw new Error('无法创建标签页');
  }

  // 保存上下文
  const fullContext: PageContext = {
    ...context,
    tab_id: tab.id,
    created_at: new Date().toISOString(),
  };

  await contextService.saveContext(fullContext);
}

/**
 * 监听标签页关闭事件，清理上下文
 */
chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  // 清理该标签页的上下文
  // 由于我们使用 Session Storage，标签页关闭后会自动清理
  // 这里可以添加额外的清理逻辑
});

/**
 * 定期清理过期上下文（每 10 分钟）
 */
setInterval(async () => {
  try {
    await contextService.cleanupExpired();
  } catch (error) {
    console.error('清理过期上下文失败:', error);
  }
}, 10 * 60 * 1000);

/**
 * 监听来自 Options 页面的消息
 */
import { messageRouter } from './message-router';

messageRouter.register('OPEN_PAGE_WITH_CONTEXT', (message, sender, sendResponse) => {
  openPageWithContext(message.url, message.context)
    .then(() => {
      sendResponse({ success: true });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });
  return true; // 异步响应
});
