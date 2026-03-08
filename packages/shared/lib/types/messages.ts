/**
 * 消息类型定义
 */

import type { FillPageState } from './models.js';

/**
 * 消息类型枚举
 */
export enum MessageType {
  // Popup -> Content Script
  GET_FILL_PAGE_STATE = 'GET_FILL_PAGE_STATE',
  DETECT_PAGE_FORMS = 'DETECT_PAGE_FORMS',
  LOCATE_NEXT_FORM = 'LOCATE_NEXT_FORM',
  FILL_SELECTED_WEBSITE = 'FILL_SELECTED_WEBSITE',

  // Popup -> Background
  OPEN_NEXT_BACKLINKS = 'OPEN_NEXT_BACKLINKS',

  // Content Script -> Background
  SYNC_BACKLINKS = 'SYNC_BACKLINKS',
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
