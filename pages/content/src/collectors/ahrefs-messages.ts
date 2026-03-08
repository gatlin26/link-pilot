/**
 * Ahrefs 收集器消息类型定义
 */

import type { CollectedBacklink } from '@extension/shared/lib/types/models';

/**
 * 消息类型
 */
export enum AhrefsMessageType {
  // 页面状态
  AHREFS_PAGE_READY = 'AHREFS_PAGE_READY',

  // 收集控制
  START_COLLECTION = 'START_COLLECTION',
  STOP_COLLECTION = 'STOP_COLLECTION',
  GET_PROGRESS = 'GET_PROGRESS',
  CHECK_STATUS = 'CHECK_STATUS',

  // 收集事件
  COLLECTION_STARTED = 'COLLECTION_STARTED',
  COLLECTION_COMPLETED = 'COLLECTION_COMPLETED',
  COLLECTION_FAILED = 'COLLECTION_FAILED',
  COLLECTION_PROGRESS = 'COLLECTION_PROGRESS',
}

/**
 * 页面就绪消息
 */
export interface AhrefsPageReadyMessage {
  type: AhrefsMessageType.AHREFS_PAGE_READY;
  url: string;
}

/**
 * 开始收集消息
 */
export interface StartCollectionMessage {
  type: AhrefsMessageType.START_COLLECTION;
  maxCount: number;
}

/**
 * 停止收集消息
 */
export interface StopCollectionMessage {
  type: AhrefsMessageType.STOP_COLLECTION;
}

/**
 * 获取进度消息
 */
export interface GetProgressMessage {
  type: AhrefsMessageType.GET_PROGRESS;
}

/**
 * 检查状态消息
 */
export interface CheckStatusMessage {
  type: AhrefsMessageType.CHECK_STATUS;
}

/**
 * 收集开始事件
 */
export interface CollectionStartedMessage {
  type: AhrefsMessageType.COLLECTION_STARTED;
  maxCount: number;
}

/**
 * 收集完成事件
 */
export interface CollectionCompletedMessage {
  type: AhrefsMessageType.COLLECTION_COMPLETED;
  count: number;
  batchId: string;
}

/**
 * 收集失败事件
 */
export interface CollectionFailedMessage {
  type: AhrefsMessageType.COLLECTION_FAILED;
  error: string;
}

/**
 * 收集进度事件
 */
export interface CollectionProgressMessage {
  type: AhrefsMessageType.COLLECTION_PROGRESS;
  current: number;
  target: number;
}

/**
 * 所有消息类型
 */
export type AhrefsMessage =
  | AhrefsPageReadyMessage
  | StartCollectionMessage
  | StopCollectionMessage
  | GetProgressMessage
  | CheckStatusMessage
  | CollectionStartedMessage
  | CollectionCompletedMessage
  | CollectionFailedMessage
  | CollectionProgressMessage;

/**
 * 收集响应
 */
export interface CollectionResponse {
  success: boolean;
  count?: number;
  backlinks?: CollectedBacklink[];
  error?: string;
}

/**
 * 进度响应
 */
export interface ProgressResponse {
  success: boolean;
  progress?: {
    current: number;
    target: number;
  } | null;
  error?: string;
}

/**
 * 状态响应
 */
export interface StatusResponse {
  success: boolean;
  isCollecting?: boolean;
  isSupported?: boolean;
  platform?: string;
  error?: string;
}
