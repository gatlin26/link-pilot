/**
 * 悬浮球控制器 - 简化版
 * 用于 content script 直接渲染
 */

import type { FormDetector, FormDetectionResult } from '../form-handlers/form-detector';
import type { WebsiteProfile, ManagedBacklink } from '@extension/shared';

export { FloatingBallState, MessageTypes } from './controller';
import { FloatingBallState, MessageTypes } from './controller';

/**
 * 悬浮球配置
 */
interface FloatingBallConfig {
  formDetector: FormDetector;
  autoDetect: boolean;
  highConfidenceThreshold: number;
  lowConfidenceThreshold: number;
  onStateChange?: (state: FloatingBallState) => void;
  onFillRequest?: (payload: FillPayload) => void;
}

/**
 * 填充数据
 */
export interface FillPayload {
  profileId: string;
  backlinkId: string;
  fillMode: 'smart' | 'manual';
  comment?: string;
}

/**
 * 悬浮球 API
 */
export interface FloatingBallAPI {
  show: () => void;
  hide: () => void;
  expand: () => void;
  collapse: () => void;
  setMatchedBacklink: (backlink: ManagedBacklink | null, confidence: number) => void;
  updateProfiles: (profiles: WebsiteProfile[]) => void;
  setFormDetected: (result: FormDetectionResult) => void;
  getState: () => FloatingBallState;
  destroy: () => void;
}

/**
 * 初始化悬浮球
 * 在 content script 中调用
 */
export function initFloatingBall(config: FloatingBallConfig): FloatingBallAPI {
  // 当前状态
  let state = FloatingBallState.HIDDEN;
  let profiles: WebsiteProfile[] = [];
  let matchedBacklink: ManagedBacklink | null = null;
  let matchConfidence = 0;
  let detectedForm: FormDetectionResult | null = null;
  let detectionInterval: number | null = null;

  // 设置初始状态
  function setState(newState: FloatingBallState) {
    if (state === newState) return;
    state = newState;
    emitStateChange();
    config.onStateChange?.(newState);
  }

  // 发送状态变更事件
  function emitStateChange() {
    window.dispatchEvent(
      new CustomEvent('LINK_PILOT_FLOATING_BALL_STATE', {
        detail: {
          state,
          profiles,
          detectedForm,
          matchedBacklink,
          matchConfidence,
          currentUrl: window.location.href,
        },
      })
    );
  }

  // 表单检测
  async function detectForm() {
    try {
      const result = await config.formDetector.detect();
      detectedForm = result;

      if (result.detected) {
        if (result.confidence >= config.highConfidenceThreshold) {
          setState(FloatingBallState.DETECTED_BREATH);
        } else if (result.confidence >= config.lowConfidenceThreshold) {
          setState(FloatingBallState.DETECTED_SUBTLE);
        }
      }
    } catch (error) {
      console.error('[FloatingBall] Detection error:', error);
    }
  }

  // 启动检测
  if (config.autoDetect) {
    detectForm();
    detectionInterval = window.setInterval(detectForm, 3000);
  }

  // 监听来自 UI 的消息
  const handleMessage = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (!event.data?.type?.startsWith('LINK_PILOT_')) return;

    switch (event.data.type) {
      case 'LINK_PILOT_EXPAND':
        setState(FloatingBallState.EXPANDED);
        break;
      case 'LINK_PILOT_COLLAPSE':
        setState(FloatingBallState.COLLAPSED);
        break;
      case 'LINK_PILOT_FILL':
        config.onFillRequest?.(event.data.payload);
        break;
      case 'LINK_PILOT_CLOSE':
        setState(FloatingBallState.HIDDEN);
        break;
    }
  };

  window.addEventListener('message', handleMessage);

  // 初始显示
  setState(FloatingBallState.COLLAPSED);

  // 返回 API
  return {
    show: () => setState(FloatingBallState.COLLAPSED),
    hide: () => setState(FloatingBallState.HIDDEN),
    expand: () => setState(FloatingBallState.EXPANDED),
    collapse: () => setState(FloatingBallState.COLLAPSED),
    setMatchedBacklink: (backlink, confidence) => {
      matchedBacklink = backlink;
      matchConfidence = confidence;
      emitStateChange();
    },
    updateProfiles: (newProfiles) => {
      profiles = newProfiles;
      emitStateChange();
    },
    setFormDetected: (result) => {
      detectedForm = result;
      emitStateChange();
    },
    getState: () => state,
    destroy: () => {
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
      window.removeEventListener('message', handleMessage);
      setState(FloatingBallState.HIDDEN);
    },
  };
}
