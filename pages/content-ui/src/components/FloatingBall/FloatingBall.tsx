/**
 * 悬浮球主组件
 * 包含不同状态的 UI 表现：收起态、呼吸态、展开态
 */

import { useEffect, useCallback, useRef } from 'react';
import { FloatingPanel } from './FloatingPanel';
import {
  FloatingBallState,
  type FloatingBallProps,
} from './types';

/**
 * 悬浮球主组件
 */
export function FloatingBall({
  profiles,
  currentUrl,
  detectedForm,
  matchedBacklink,
  matchConfidence,
  state,
  onStateChange,
  onFill,
  onClose,
}: FloatingBallProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state === FloatingBallState.EXPANDED) {
        onStateChange(FloatingBallState.COLLAPSED);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state, onStateChange]);

  // 点击外部收起
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        state === FloatingBallState.EXPANDED &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onStateChange(FloatingBallState.COLLAPSED);
      }
    };

    // 延迟绑定，避免点击展开按钮时立即收起
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [state, onStateChange]);

  // 展开面板
  const handleExpand = useCallback(() => {
    if (state !== FloatingBallState.FILLING) {
      onStateChange(FloatingBallState.EXPANDED);
    }
  }, [state, onStateChange]);

  // 最小化
  const handleMinimize = useCallback(() => {
    onStateChange(FloatingBallState.COLLAPSED);
  }, [onStateChange]);

  // 根据状态渲染不同内容
  const renderContent = () => {
    switch (state) {
      case FloatingBallState.HIDDEN:
        return null;

      case FloatingBallState.COLLAPSED:
        return (
          <CollapsedBall
            onClick={handleExpand}
            variant="default"
          />
        );

      case FloatingBallState.DETECTED_BREATH:
        return (
          <CollapsedBall
            onClick={handleExpand}
            variant="breathing"
          />
        );

      case FloatingBallState.DETECTED_SUBTLE:
        return (
          <CollapsedBall
            onClick={handleExpand}
            variant="subtle"
          />
        );

      case FloatingBallState.EXPANDED:
      case FloatingBallState.FILLING:
      case FloatingBallState.SUCCESS:
      case FloatingBallState.ERROR:
        return (
          <FloatingPanel
            profiles={profiles}
            currentUrl={currentUrl}
            detectedForm={detectedForm}
            matchedBacklink={matchedBacklink}
            matchConfidence={matchConfidence}
            state={state}
            onFill={onFill}
            onClose={onClose}
            onMinimize={handleMinimize}
          />
        );

      default:
        return null;
    }
  };

  if (state === FloatingBallState.HIDDEN) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed bottom-4 right-4 z-[2147483647]"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {renderContent()}
    </div>
  );
}

/**
 * 收起态悬浮球
 */
interface CollapsedBallProps {
  onClick: () => void;
  variant: 'default' | 'breathing' | 'subtle';
}

function CollapsedBall({ onClick, variant }: CollapsedBallProps) {
  const getStyles = () => {
    switch (variant) {
      case 'breathing':
        return {
          size: 'w-14 h-14',
          bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
          shadow: 'shadow-lg shadow-blue-500/30',
          animation: 'animate-breathing',
          iconSize: 'w-6 h-6',
        };
      case 'subtle':
        return {
          size: 'w-8 h-8',
          bg: 'bg-blue-500',
          shadow: 'shadow-md',
          animation: '',
          iconSize: 'w-4 h-4',
        };
      default:
        return {
          size: 'w-12 h-12',
          bg: 'bg-gradient-to-br from-gray-600 to-gray-700',
          shadow: 'shadow-lg',
          animation: '',
          iconSize: 'w-5 h-5',
        };
    }
  };

  const styles = getStyles();

  return (
    <>
      <style>{`
        @keyframes breathing {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4), 0 8px 10px -6px rgba(59, 130, 246, 0.2);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 20px 35px -5px rgba(59, 130, 246, 0.5), 0 12px 15px -6px rgba(59, 130, 246, 0.3);
          }
        }
        .animate-breathing {
          animation: breathing 2s ease-in-out infinite;
        }
      `}</style>
      <button
        onClick={onClick}
        className={`
          flex items-center justify-center rounded-full text-white
          transition-all duration-200 hover:scale-110 active:scale-95
          ${styles.size} ${styles.bg} ${styles.shadow} ${styles.animation}
        `}
        title="Link Pilot"
      >
        <svg
          className={styles.iconSize}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </button>
    </>
  );
}
