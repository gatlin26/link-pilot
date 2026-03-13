/**
 * 统一的消息路由器
 * 确保所有消息都能被正确处理
 */

import {
  type BaseMessage,
  type BaseResponse,
  MessageType,
  type MatchResult,
} from '@extension/shared';
import {
  managedBacklinkStorage,
  websiteProfileStorage,
  submissionSessionStorage,
} from '@extension/storage';

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

    // 注册智能匹配处理器
    this.register(MessageType.SMART_MATCH_BACKLINK, this.handleSmartMatchBacklink.bind(this));

    // 注册快速添加外链处理器
    this.register(MessageType.QUICK_ADD_BACKLINK, this.handleQuickAddBacklink.bind(this));

    // 注册一键填充处理器
    this.register(MessageType.ONE_CLICK_FILL, this.handleOneClickFill.bind(this));

    // 注册 URL 变更处理器
    this.register(MessageType.URL_CHANGED, this.handleUrlChanged.bind(this));

    // 注册悬浮面板相关处理器
    this.register(MessageType.OPEN_FLOATING_PANEL, this.handleOpenFloatingPanel.bind(this));
    this.register(MessageType.CLOSE_FLOATING_PANEL, this.handleCloseFloatingPanel.bind(this));

    // 注册表单检测处理器
    this.register(MessageType.FORCE_DETECT_FORM, this.handleForceDetectForm.bind(this));

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

  // === 智能匹配相关处理器 ===

  /**
   * 处理智能匹配外链请求
   */
  private handleSmartMatchBacklink(
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BaseResponse) => void,
  ): boolean {
    (async () => {
      try {
        const payload = message.payload as { currentUrl: string; currentTitle?: string } | undefined;
        if (!payload?.currentUrl) {
          sendResponse({ success: false, error: '缺少 currentUrl 参数' });
          return;
        }

        const { currentUrl, currentTitle } = payload;
        console.log('[Message Router] 处理智能匹配请求:', currentUrl);

        // 执行智能匹配
        const matchResult = await this.performSmartMatch(currentUrl, currentTitle);

        // 广播匹配结果更新
        await this.broadcastMatchResult(matchResult, currentUrl, sender.tab?.id);

        sendResponse({ success: true, data: matchResult });
      } catch (error) {
        console.error('[Message Router] 智能匹配失败:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '智能匹配失败',
        });
      }
    })();

    return true; // 异步响应
  }

  /**
   * 执行智能匹配逻辑
   */
  private async performSmartMatch(
    currentUrl: string,
    currentTitle?: string,
  ): Promise<MatchResult> {
    const backlinks = await managedBacklinkStorage.getAllBacklinks();

    if (backlinks.length === 0) {
      return {
        bestMatch: null,
        confidence: 0,
        alternatives: [],
      };
    }

    // 标准化 URL 用于比较
    const normalizeUrl = (url: string): string => {
      try {
        const urlObj = new URL(url);
        return `${urlObj.hostname}${urlObj.pathname}`.replace(/\/$/, '').toLowerCase();
      } catch {
        return url.toLowerCase().replace(/\/$/, '');
      }
    };

    const normalizedCurrentUrl = normalizeUrl(currentUrl);
    const currentDomain = new URL(currentUrl).hostname.toLowerCase();

    // 计算每个外链的匹配分数
    const scoredBacklinks = backlinks.map(backlink => {
      let score = 0;
      const normalizedBacklinkUrl = normalizeUrl(backlink.url);
      const backlinkDomain = backlink.domain.toLowerCase();

      // URL 完全匹配得分最高
      if (normalizedBacklinkUrl === normalizedCurrentUrl) {
        score += 100;
      }
      // 域名匹配
      else if (backlinkDomain === currentDomain) {
        score += 50;
      }
      // URL 包含关系
      else if (normalizedCurrentUrl.includes(normalizedBacklinkUrl) ||
               normalizedBacklinkUrl.includes(normalizedCurrentUrl)) {
        score += 30;
      }

      // 关键词匹配（如果有标题）
      if (currentTitle && backlink.keywords?.length > 0) {
        const titleLower = currentTitle.toLowerCase();
        const matchedKeywords = backlink.keywords.filter(kw =>
          titleLower.includes(kw.toLowerCase())
        );
        score += matchedKeywords.length * 10;
      }

      // 备注匹配（如果有标题）
      if (currentTitle && backlink.note) {
        const noteLower = backlink.note.toLowerCase();
        if (currentTitle.toLowerCase().includes(noteLower) ||
            noteLower.includes(currentTitle.toLowerCase())) {
          score += 15;
        }
      }

      return { backlink, score };
    });

    // 按分数排序
    scoredBacklinks.sort((a, b) => b.score - a.score);

    // 取最高分的作为最佳匹配
    const bestMatch = scoredBacklinks[0]?.score >= 30 ? scoredBacklinks[0].backlink : null;
    const confidence = scoredBacklinks[0]?.score || 0;

    // 取分数在 20 以上的作为备选
    const alternatives = scoredBacklinks
      .slice(1, 5)
      .filter(item => item.score >= 20)
      .map(item => item.backlink);

    return {
      bestMatch,
      confidence,
      alternatives,
    };
  }

  /**
   * 广播匹配结果更新
   */
  private async broadcastMatchResult(
    matchResult: MatchResult,
    sourceUrl: string,
    sourceTabId?: number,
  ): Promise<void> {
    const message = {
      type: MessageType.MATCH_RESULT_UPDATED,
      payload: {
        ...matchResult,
        sourceUrl,
        timestamp: Date.now(),
      },
    };

    // 发送到源标签页的内容脚本
    if (sourceTabId) {
      try {
        await chrome.tabs.sendMessage(sourceTabId, message);
      } catch (error) {
        console.warn('[Message Router] 发送匹配结果到内容脚本失败:', error);
      }
    }

    // 广播到其他组件（Side Panel、Popup）
    void chrome.runtime.sendMessage(message).catch(error => {
      console.warn('[Message Router] 广播匹配结果失败:', error);
    });
  }

  // === 快速添加外链处理器 ===

  /**
   * 处理快速添加外链请求
   */
  private handleQuickAddBacklink(
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BaseResponse) => void,
  ): boolean {
    (async () => {
      try {
        const payload = message.payload as {
          url: string;
          domain: string;
          note?: string;
          keywords?: string[];
          groupId?: string;
        } | undefined;

        if (!payload?.url || !payload?.domain) {
          sendResponse({ success: false, error: '缺少 url 或 domain 参数' });
          return;
        }

        const { url, domain, note, keywords, groupId } = payload;
        console.log('[Message Router] 处理快速添加外链:', url);

        // 检查 URL 是否已存在
        const existingBacklinks = await managedBacklinkStorage.getAllBacklinks();
        const normalizedUrl = url.trim().replace(/\/$/, '').toLowerCase();
        const exists = existingBacklinks.some(
          b => b.url.trim().replace(/\/$/, '').toLowerCase() === normalizedUrl
        );

        if (exists) {
          sendResponse({ success: false, error: '该 URL 已存在' });
          return;
        }

        // 创建新外链
        const newBacklink = {
          id: crypto.randomUUID(),
          group_id: groupId || 'default',
          url,
          domain,
          note,
          keywords: keywords || [],
          flagged: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await managedBacklinkStorage.addBacklink(newBacklink);

        // 广播外链添加成功
        const addedMessage = {
          type: MessageType.BACKLINK_ADDED,
          payload: {
            backlink: newBacklink,
            addedAt: new Date().toISOString(),
          },
        };

        void chrome.runtime.sendMessage(addedMessage).catch(error => {
          console.warn('[Message Router] 广播外链添加结果失败:', error);
        });

        sendResponse({ success: true, data: { backlinkId: newBacklink.id } });
      } catch (error) {
        console.error('[Message Router] 快速添加外链失败:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '添加外链失败',
        });
      }
    })();

    return true; // 异步响应
  }

  // === 一键填充处理器 ===

  /**
   * 处理一键填充请求
   */
  private handleOneClickFill(
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BaseResponse) => void,
  ): boolean {
    (async () => {
      try {
        const payload = message.payload as {
          profileId: string;
          backlinkId?: string;
          comment?: string;
          autoSubmit?: boolean;
        } | undefined;

        if (!payload?.profileId) {
          sendResponse({ success: false, error: '缺少 profileId 参数' });
          return;
        }

        const { profileId, backlinkId, comment, autoSubmit } = payload;
        console.log('[Message Router] 处理一键填充:', profileId);

        // 验证 profile 是否存在
        const profile = await websiteProfileStorage.getProfileById(profileId);
        if (!profile) {
          sendResponse({ success: false, error: '网站资料不存在' });
          return;
        }

        // 更新提交会话
        const session = await submissionSessionStorage.getSession();
        await submissionSessionStorage.updateSession({
          selected_website_id: profileId,
          current_backlink_id: backlinkId,
        });

        // 发送到内容脚本执行填充
        if (sender.tab?.id) {
          const fillMessage = {
            type: MessageType.ONE_CLICK_FILL,
            payload: {
              profileId,
              backlinkId,
              comment,
              autoSubmit,
            },
          };

          await chrome.tabs.sendMessage(sender.tab.id, fillMessage);
        }

        // 广播填充已开始
        const initiatedMessage = {
          type: MessageType.FILL_INITIATED,
          payload: {
            success: true,
            profileId,
            backlinkId,
            filledFields: [],
          },
        };

        void chrome.runtime.sendMessage(initiatedMessage).catch(error => {
          console.warn('[Message Router] 广播填充开始消息失败:', error);
        });

        sendResponse({ success: true, data: { profileId, backlinkId } });
      } catch (error) {
        console.error('[Message Router] 一键填充失败:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '一键填充失败',
        });
      }
    })();

    return true; // 异步响应
  }

  // === URL 变更处理器 ===

  /**
   * 处理 URL 变更通知
   */
  private handleUrlChanged(
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BaseResponse) => void,
  ): boolean {
    (async () => {
      try {
        const payload = message.payload as {
          oldUrl: string;
          newUrl: string;
          title?: string;
        } | undefined;

        if (!payload?.newUrl) {
          sendResponse({ success: false, error: '缺少 newUrl 参数' });
          return;
        }

        console.log('[Message Router] URL 变更:', payload.oldUrl, '->', payload.newUrl);

        // 触发智能匹配
        await this.performSmartMatch(payload.newUrl, payload.title);

        sendResponse({ success: true });
      } catch (error) {
        console.error('[Message Router] 处理 URL 变更失败:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '处理 URL 变更失败',
        });
      }
    })();

    return true; // 异步响应
  }

  // === 悬浮面板处理器 ===

  /**
   * 处理打开悬浮面板请求
   */
  private handleOpenFloatingPanel(
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BaseResponse) => void,
  ): boolean {
    (async () => {
      try {
        const payload = message.payload as { initialState?: 'expanded' | 'collapsed' } | undefined;

        // 广播到当前标签页的内容脚本
        if (sender.tab?.id) {
          const panelMessage = {
            type: MessageType.OPEN_FLOATING_PANEL,
            payload: payload || { initialState: 'collapsed' },
          };

          await chrome.tabs.sendMessage(sender.tab.id, panelMessage);
        }

        sendResponse({ success: true });
      } catch (error) {
        console.error('[Message Router] 打开悬浮面板失败:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '打开悬浮面板失败',
        });
      }
    })();

    return true; // 异步响应
  }

  /**
   * 处理关闭悬浮面板请求
   */
  private handleCloseFloatingPanel(
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BaseResponse) => void,
  ): boolean {
    (async () => {
      try {
        const payload = message.payload as { reason?: 'user_action' | 'auto' | 'page_navigate' } | undefined;

        // 广播到当前标签页的内容脚本
        if (sender.tab?.id) {
          const panelMessage = {
            type: MessageType.CLOSE_FLOATING_PANEL,
            payload: payload || { reason: 'user_action' },
          };

          await chrome.tabs.sendMessage(sender.tab.id, panelMessage);
        }

        sendResponse({ success: true });
      } catch (error) {
        console.error('[Message Router] 关闭悬浮面板失败:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '关闭悬浮面板失败',
        });
      }
    })();

    return true; // 异步响应
  }

  // === 表单检测处理器 ===

  /**
   * 处理强制检测表单请求
   */
  private handleForceDetectForm(
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BaseResponse) => void,
  ): boolean {
    (async () => {
      try {
        // 转发到内容脚本执行实际检测
        if (sender.tab?.id) {
          const detectMessage = {
            type: MessageType.FORCE_DETECT_FORM,
            payload: message.payload,
          };

          const response = await chrome.tabs.sendMessage(sender.tab.id, detectMessage);
          sendResponse(response);
        } else {
          sendResponse({ success: false, error: '无法确定目标标签页' });
        }
      } catch (error) {
        console.error('[Message Router] 强制检测表单失败:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '强制检测表单失败',
        });
      }
    })();

    return true; // 异步响应
  }
}

// 导出单例
export const messageRouter = new MessageRouter();
