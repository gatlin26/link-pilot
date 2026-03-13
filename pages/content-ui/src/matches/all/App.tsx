import { useEffect, useState, useCallback } from 'react';
import { FloatingBall } from '@src/components/FloatingBall';
import {
  FloatingBallState,
  type WebsiteProfile,
  type ManagedBacklink,
  type FormDetectionResult,
  type FillPayload,
} from '@src/components/FloatingBall/types';

/**
 * Content UI 主应用
 * 集成悬浮球组件
 */
export default function App() {
  // 悬浮球状态
  const [state, setState] = useState<FloatingBallState>(FloatingBallState.HIDDEN);

  // 数据
  const [profiles, setProfiles] = useState<WebsiteProfile[]>([]);
  const [detectedForm, setDetectedForm] = useState<FormDetectionResult | null>(null);
  const [matchedBacklink, setMatchedBacklink] = useState<ManagedBacklink | null>(null);
  const [matchConfidence, setMatchConfidence] = useState<number>(0);
  const [currentUrl, setCurrentUrl] = useState<string>(window.location.href);

  // 监听来自 content script 的状态更新
  useEffect(() => {
    const handleStateUpdate = (event: CustomEvent) => {
      const detail = event.detail;
      if (detail.state !== undefined) setState(detail.state);
      if (detail.profiles !== undefined) setProfiles(detail.profiles);
      if (detail.detectedForm !== undefined) setDetectedForm(detail.detectedForm);
      if (detail.matchedBacklink !== undefined) setMatchedBacklink(detail.matchedBacklink);
      if (detail.matchConfidence !== undefined) setMatchConfidence(detail.matchConfidence);
      if (detail.currentUrl !== undefined) setCurrentUrl(detail.currentUrl);
    };

    window.addEventListener(
      'LINK_PILOT_FLOATING_BALL_STATE' as unknown as keyof WindowEventMap,
      handleStateUpdate as EventListener
    );

    // 监听外链匹配更新
    const handleBacklinkMatched = (event: CustomEvent) => {
      const detail = event.detail;
      if (detail.backlink !== undefined) setMatchedBacklink(detail.backlink);
      if (detail.confidence !== undefined) setMatchConfidence(detail.confidence);
    };

    window.addEventListener(
      'LINK_PILOT_BACKLINK_MATCHED' as unknown as keyof WindowEventMap,
      handleBacklinkMatched as EventListener
    );

    return () => {
      window.removeEventListener(
        'LINK_PILOT_FLOATING_BALL_STATE' as unknown as keyof WindowEventMap,
        handleStateUpdate as EventListener
      );
      window.removeEventListener(
        'LINK_PILOT_BACKLINK_MATCHED' as unknown as keyof WindowEventMap,
        handleBacklinkMatched as EventListener
      );
    };
  }, []);

  // 状态变更处理
  const handleStateChange = useCallback((newState: FloatingBallState) => {
    setState(newState);

    // 通知 content script
    let messageType = '';
    switch (newState) {
      case FloatingBallState.EXPANDED:
        messageType = 'LINK_PILOT_EXPAND';
        break;
      case FloatingBallState.COLLAPSED:
        messageType = 'LINK_PILOT_COLLAPSE';
        break;
      case FloatingBallState.HIDDEN:
        messageType = 'LINK_PILOT_CLOSE';
        break;
    }

    if (messageType) {
      window.postMessage({ type: messageType }, '*');
    }
  }, []);

  // 填充处理
  const handleFill = useCallback((payload: FillPayload) => {
    // 通知 content script 执行填充
    window.postMessage({ type: 'LINK_PILOT_FILL', payload }, '*');
  }, []);

  // 关闭处理
  const handleClose = useCallback(() => {
    setState(FloatingBallState.HIDDEN);
    window.postMessage({ type: 'LINK_PILOT_CLOSE' }, '*');
  }, []);

  console.log('[Link Pilot] Content UI initialized with FloatingBall');

  return (
    <FloatingBall
      profiles={profiles}
      currentUrl={currentUrl}
      detectedForm={detectedForm}
      matchedBacklink={matchedBacklink}
      matchConfidence={matchConfidence}
      state={state}
      onStateChange={handleStateChange}
      onFill={handleFill}
      onClose={handleClose}
    />
  );
}
