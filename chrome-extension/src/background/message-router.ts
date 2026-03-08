/**
 * 统一的消息路由器
 * 确保所有消息都能被正确处理
 */

type MessageHandler = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean | void;

class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();
  private initialized = false;

  /**
   * 注册消息处理器
   */
  register(messageType: string, handler: MessageHandler): void {
    if (this.handlers.has(messageType)) {
      console.warn(`[Message Router] 消息类型 ${messageType} 已存在，将被覆盖`);
    }
    this.handlers.set(messageType, handler);
    console.log(`[Message Router] 注册消息处理器: ${messageType}`);
  }

  /**
   * 初始化消息监听器
   */
  init(): void {
    if (this.initialized) {
      console.warn('[Message Router] 已经初始化过了');
      return;
    }

    // 注册内置的 PING 处理器
    this.register('PING', (message, sender, sendResponse) => {
      sendResponse({ success: true, pong: true });
      return false;
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const messageType = message?.type;

      if (!messageType) {
        console.warn('[Message Router] 收到无效消息（缺少 type）:', message);
        sendResponse({ success: false, error: '无效的消息格式' });
        return false;
      }

      console.log('[Message Router] 收到消息:', messageType, 'from', sender.tab?.id || 'popup');

      const handler = this.handlers.get(messageType);

      if (!handler) {
        console.warn('[Message Router] 未找到消息处理器:', messageType);
        // 不发送响应，让其他监听器处理
        return false;
      }

      try {
        const result = handler(message, sender, sendResponse);
        // 如果处理器返回 true，表示会异步发送响应
        return result === true;
      } catch (error) {
        console.error('[Message Router] 处理消息时出错:', messageType, error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '处理消息时出错',
        });
        return false;
      }
    });

    this.initialized = true;
    console.log('[Message Router] 消息路由器已初始化');
  }

  /**
   * 获取已注册的消息类型列表
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// 导出单例
export const messageRouter = new MessageRouter();
