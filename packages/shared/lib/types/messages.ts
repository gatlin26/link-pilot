/**
 * 消息类型定义
 */

import type { FillPageState, ManagedBacklink } from './models.js';

/**
 * 消息类型枚举
 */
export enum MessageType {
  // === Popup -> Content Script ===
  GET_FILL_PAGE_STATE = 'GET_FILL_PAGE_STATE',
  DETECT_PAGE_FORMS = 'DETECT_PAGE_FORMS',
  LOCATE_NEXT_FORM = 'LOCATE_NEXT_FORM',
  FILL_SELECTED_WEBSITE = 'FILL_SELECTED_WEBSITE',

  // === Popup -> Background ===
  OPEN_NEXT_BACKLINKS = 'OPEN_NEXT_BACKLINKS',

  // === Content Script -> Background ===
  SYNC_BACKLINKS = 'SYNC_BACKLINKS',

  // === 新增：悬浮球相关 ===
  OPEN_FLOATING_PANEL = 'OPEN_FLOATING_PANEL',
  CLOSE_FLOATING_PANEL = 'CLOSE_FLOATING_PANEL',
  FLOATING_PANEL_STATE_CHANGED = 'FLOATING_PANEL_STATE_CHANGED',

  // === 新增：智能匹配相关 ===
  SMART_MATCH_BACKLINK = 'SMART_MATCH_BACKLINK',
  MATCH_RESULT_UPDATED = 'MATCH_RESULT_UPDATED',
  URL_CHANGED = 'URL_CHANGED',

  // === 新增：快速添加外链相关 ===
  QUICK_ADD_BACKLINK = 'QUICK_ADD_BACKLINK',
  BACKLINK_ADDED = 'BACKLINK_ADDED',

  // === 新增：一键填充相关 ===
  ONE_CLICK_FILL = 'ONE_CLICK_FILL',
  FILL_INITIATED = 'FILL_INITIATED',

  // === 新增：表单检测相关 ===
  FORM_DETECTED = 'FORM_DETECTED',
  FORCE_DETECT_FORM = 'FORCE_DETECT_FORM',

  // === 新增：LLM 评论生成相关 ===
  GENERATE_LLM_COMMENT = 'GENERATE_LLM_COMMENT',
}

/**
 * 基础消息结构
 */
export interface BaseMessage<T = unknown> {
  type: MessageType | string;
  payload?: T;
}

/**
 * 基础响应结构
 */
export interface BaseResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

/**
 * 获取当前页面填表状态响应
 */
export interface GetFillPageStateResponse extends BaseResponse<FillPageState> {
  success: boolean;
  data?: FillPageState;
}

// === 新增：悬浮球相关消息 ===

/**
 * 打开悬浮面板消息
 */
export interface OpenFloatingPanelMessage extends BaseMessage {
  type: MessageType.OPEN_FLOATING_PANEL;
  payload?: {
    initialState?: 'expanded' | 'collapsed';
  };
}

/**
 * 关闭悬浮面板消息
 */
export interface CloseFloatingPanelMessage extends BaseMessage {
  type: MessageType.CLOSE_FLOATING_PANEL;
  payload?: {
    reason?: 'user_action' | 'auto' | 'page_navigate';
  };
}

/**
 * 悬浮面板状态变更消息
 */
export interface FloatingPanelStateChangedMessage extends BaseMessage {
  type: MessageType.FLOATING_PANEL_STATE_CHANGED;
  payload: {
    isOpen: boolean;
    state: 'expanded' | 'collapsed';
    matchResult?: MatchResult;
  };
}

// === 新增：智能匹配相关消息 ===

/**
 * 智能匹配结果
 */
export interface MatchResult {
  bestMatch: ManagedBacklink | null;
  confidence: number;
  alternatives: ManagedBacklink[];
}

/**
 * 智能匹配外链请求消息
 */
export interface SmartMatchBacklinkMessage extends BaseMessage {
  type: MessageType.SMART_MATCH_BACKLINK;
  payload: {
    currentUrl: string;
    currentTitle?: string;
  };
}

/**
 * 匹配结果更新消息
 */
export interface MatchResultUpdatedMessage extends BaseMessage {
  type: MessageType.MATCH_RESULT_UPDATED;
  payload: MatchResult & {
    sourceUrl: string;
    timestamp: number;
  };
}

/**
 * URL 变更消息
 */
export interface UrlChangedMessage extends BaseMessage {
  type: MessageType.URL_CHANGED;
  payload: {
    oldUrl: string;
    newUrl: string;
    title?: string;
  };
}

// === 新增：快速添加外链相关消息 ===

/**
 * 快速添加外链请求消息
 */
export interface QuickAddBacklinkMessage extends BaseMessage {
  type: MessageType.QUICK_ADD_BACKLINK;
  payload: {
    url: string;
    domain: string;
    note?: string;
    keywords?: string[];
    groupId?: string;
  };
}

/**
 * 外链添加成功消息
 */
export interface BacklinkAddedMessage extends BaseMessage {
  type: MessageType.BACKLINK_ADDED;
  payload: {
    backlink: ManagedBacklink;
    addedAt: string;
  };
}

// === 新增：一键填充相关消息 ===

/**
 * 一键填充请求消息
 */
export interface OneClickFillMessage extends BaseMessage {
  type: MessageType.ONE_CLICK_FILL;
  payload: {
    profileId: string;
    backlinkId?: string;
    comment?: string;
    autoSubmit?: boolean;
  };
}

/**
 * 填充已开始消息
 */
export interface FillInitiatedMessage extends BaseMessage {
  type: MessageType.FILL_INITIATED;
  payload: {
    success: boolean;
    profileId: string;
    backlinkId?: string;
    filledFields: string[];
    error?: string;
  };
}

// === 新增：表单检测相关消息 ===

/**
 * 表单检测结果消息
 */
export interface FormDetectedMessage extends BaseMessage {
  type: MessageType.FORM_DETECTED;
  payload: {
    detected: boolean;
    confidence: number;
    fieldTypes: Array<'name' | 'email' | 'website' | 'comment' | 'submit'>;
    selectors?: string[];
  };
}

/**
 * 强制检测表单消息
 */
export interface ForceDetectFormMessage extends BaseMessage {
  type: MessageType.FORCE_DETECT_FORM;
  payload?: {
    retryCount?: number;
  };
}

// === 新增：LLM 评论生成相关消息 ===

/**
 * 生成 LLM 评论请求
 */
export interface GenerateLLMCommentMessage extends BaseMessage {
  type: MessageType.GENERATE_LLM_COMMENT;
  payload: {
    /** 页面标题 */
    pageTitle: string;
    /** 页面描述 */
    pageDescription: string;
    /** 页面 H1 */
    pageH1: string;
    /** 页面 URL */
    pageUrl: string;
    /** 网站名称 */
    websiteName: string;
    /** 网站 URL */
    websiteUrl: string;
    /** 网站简介 */
    websiteDescription?: string;
    /** 外链备注 */
    backlinkNote?: string;
  };
}

/**
 * 生成 LLM 评论响应
 */
export interface GenerateLLMCommentResponse extends BaseResponse<string> {
  success: boolean;
  data?: string; // 生成的评论内容
  error?: string;
}

/**
 * 消息联合类型 - 用于类型守卫
 */
export type LinkPilotMessage =
  | OpenFloatingPanelMessage
  | CloseFloatingPanelMessage
  | FloatingPanelStateChangedMessage
  | SmartMatchBacklinkMessage
  | MatchResultUpdatedMessage
  | UrlChangedMessage
  | QuickAddBacklinkMessage
  | BacklinkAddedMessage
  | OneClickFillMessage
  | FillInitiatedMessage
  | FormDetectedMessage
  | GenerateLLMCommentMessage
  | ForceDetectFormMessage;

/**
 * 消息处理器类型
 */
export type MessageHandler<T extends BaseMessage = BaseMessage, R = unknown> = (
  message: T,
  sender: chrome.runtime.MessageSender
) => Promise<BaseResponse<R>> | BaseResponse<R>;

/**
 * 广播消息目标
 */
export type BroadcastTarget = 'content' | 'sidepanel' | 'popup' | 'background' | 'all';

/**
 * 广播消息选项
 */
export interface BroadcastOptions {
  targets?: BroadcastTarget[];
  excludeTabId?: number;
  includeCurrentTab?: boolean;
}
