/**
 * 自动填充提示组件
 * 用于显示自动填充的提示和确认界面
 */

import { useState, useEffect } from 'react';
import type { ConfidenceLevel } from '../../../content/src/form-handlers/confidence-calculator';

export interface AutoFillPromptProps {
  /** 置信度等级 */
  confidenceLevel: ConfidenceLevel;
  /** 置信度分数 */
  confidence: number;
  /** 将要使用的资料名称 */
  profileName?: string;
  /** 是否显示 */
  visible: boolean;
  /** 确认填充回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 选择其他资料回调 */
  onSelectProfile?: () => void;
  /** 撤销回调（仅在已填充后显示） */
  onUndo?: () => void;
  /** 是否已填充 */
  isFilled?: boolean;
}

/**
 * 自动填充提示组件
 */
export function AutoFillPrompt({
  confidenceLevel,
  confidence,
  profileName,
  visible,
  onConfirm,
  onCancel,
  onSelectProfile,
  onUndo,
  isFilled = false,
}: AutoFillPromptProps) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    setShow(visible);
  }, [visible]);

  if (!show) return null;

  // 已填充状态 - 显示成功提示
  if (isFilled) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <span>✓ 已自动填充表单</span>
        {onUndo && (
          <button
            onClick={onUndo}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            撤销
          </button>
        )}
        <button
          onClick={() => setShow(false)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>
    );
  }

  // 未填充状态 - 显示确认提示
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 10000,
        minWidth: '320px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
          检测到表单
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>
          置信度: {(confidence * 100).toFixed(0)}%
          {profileName && ` · 使用资料: ${profileName}`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={onConfirm}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          填充
        </button>

        {onSelectProfile && (
          <button
            onClick={onSelectProfile}
            style={{
              backgroundColor: 'white',
              color: '#3b82f6',
              border: '1px solid #3b82f6',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            选择资料
          </button>
        )}

        <button
          onClick={onCancel}
          style={{
            backgroundColor: 'white',
            color: '#6b7280',
            border: '1px solid #e5e7eb',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          忽略
        </button>
      </div>
    </div>
  );
}
