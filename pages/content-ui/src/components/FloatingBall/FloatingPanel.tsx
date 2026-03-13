/**
 * 悬浮球展开面板
 * 包含资料选择、外链选择、填充操作
 */

import { useState, useCallback, useMemo } from 'react';
import {
  FloatingBallState,
  type FloatingBallProps,
  type FillPayload,
  type WebsiteProfile,
  type ManagedBacklink,
} from './types';
import { QuickAddBacklink } from './QuickAddBacklink';

/**
 * 展开面板 Props
 */
interface FloatingPanelProps extends Omit<FloatingBallProps, 'onStateChange'> {
  onMinimize: () => void;
}

/**
 * 填充模式
 */
type FillMode = 'smart' | 'manual';

/**
 * 展开面板组件
 */
export function FloatingPanel({
  profiles,
  currentUrl,
  detectedForm,
  matchedBacklink,
  matchConfidence = 0,
  state,
  onFill,
  onClose,
  onMinimize,
}: FloatingPanelProps) {
  // 选中状态
  const [selectedProfileId, setSelectedProfileId] = useState<string>(profiles[0]?.id || '');
  const [selectedBacklinkId, setSelectedBacklinkId] = useState<string>(matchedBacklink?.id || '');
  const [fillMode, setFillMode] = useState<FillMode>('smart');
  const [manualComment, setManualComment] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newlyAddedBacklink, setNewlyAddedBacklink] = useState<ManagedBacklink | null>(null);

  // 获取选中的资料
  const selectedProfile = useMemo(
    () => profiles.find(p => p.id === selectedProfileId),
    [profiles, selectedProfileId]
  );

  // 获取当前显示的外链（优先显示新添加的）
  const currentBacklink = useMemo(() => {
    if (newlyAddedBacklink) return newlyAddedBacklink;
    return matchedBacklink || null;
  }, [newlyAddedBacklink, matchedBacklink]);

  // 是否有表单
  const hasForm = detectedForm?.detected ?? false;

  // 提交填充
  const handleFill = useCallback(() => {
    if (!selectedProfileId) return;

    const payload: FillPayload = {
      profileId: selectedProfileId,
      backlinkId: currentBacklink?.id || '',
      fillMode,
      comment: fillMode === 'manual' ? manualComment : undefined,
    };

    onFill(payload);
  }, [selectedProfileId, currentBacklink, fillMode, manualComment, onFill]);

  // 快速添加外链
  const handleQuickAdd = useCallback(() => {
    setShowQuickAdd(true);
  }, []);

  // 处理外链添加成功
  const handleBacklinkAdded = useCallback((backlink: ManagedBacklink) => {
    setNewlyAddedBacklink(backlink);
    setSelectedBacklinkId(backlink.id);
    setShowQuickAdd(false);
  }, []);

  // 取消添加
  const handleCancelAdd = useCallback(() => {
    setShowQuickAdd(false);
  }, []);

  // 状态显示
  const getStatusBadge = () => {
    switch (state) {
      case FloatingBallState.FILLING:
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
            <svg className="mr-1 h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            填充中...
          </span>
        );
      case FloatingBallState.SUCCESS:
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            填充成功
          </span>
        );
      case FloatingBallState.ERROR:
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            填充失败
          </span>
        );
      default:
        return hasForm ? (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            检测到表单
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
            未检测到表单
          </span>
        );
    }
  };

  return (
    <div className="w-80 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">Link Pilot</span>
        </div>
        <div className="flex items-center gap-1">
          {getStatusBadge()}
          <button
            onClick={onMinimize}
            className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="最小化"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="关闭"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="space-y-4 p-4">
        {showQuickAdd ? (
          /* 快速添加外链表单 */
          <QuickAddBacklink
            currentUrl={currentUrl}
            currentTitle={document.title}
            onAdded={handleBacklinkAdded}
            onCancel={handleCancelAdd}
          />
        ) : (
          <>
            {/* 网站资料选择 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">网站资料</label>
              <div className="relative">
                <select
                  value={selectedProfileId}
                  onChange={e => setSelectedProfileId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.domain})
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {selectedProfile && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="truncate">{selectedProfile.email}</span>
                </div>
              )}
            </div>

            {/* 外链选择 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">外链目标</label>
              {currentBacklink ? (
                <div className={`rounded-lg border p-3 ${newlyAddedBacklink ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{currentBacklink.domain}</span>
                    {newlyAddedBacklink && (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                        新添加
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 truncate">{currentBacklink.url}</div>
                  {currentBacklink.note && (
                    <div className="mt-1 text-xs text-gray-400">{currentBacklink.note}</div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3">
                  <span className="text-sm text-gray-400">无匹配外链</span>
                  <button
                    onClick={handleQuickAdd}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    + 添加当前页面
                  </button>
                </div>
              )}
            </div>

            {/* 填充模式 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">填充模式</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFillMode('smart')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    fillMode === 'smart'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  智能填充
                </button>
                <button
                  onClick={() => setFillMode('manual')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    fillMode === 'manual'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  手动填充
                </button>
              </div>
            </div>

            {/* 手动填充内容编辑 */}
            {fillMode === 'manual' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">评论内容</label>
                <textarea
                  value={manualComment}
                  onChange={e => setManualComment(e.target.value)}
                  placeholder="输入您的评论..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            {/* 预览 */}
            {fillMode === 'smart' && selectedProfile && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">内容预览</label>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                  <div className="space-y-1">
                    <div><span className="text-gray-400">姓名:</span> {selectedProfile.name}</div>
                    <div><span className="text-gray-400">邮箱:</span> {selectedProfile.email}</div>
                    <div><span className="text-gray-400">网站:</span> {selectedProfile.url}</div>
                    <div><span className="text-gray-400">评论:</span> {selectedProfile.comments[0] || '（使用默认评论）'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 底部添加按钮（当已有外链时显示） */}
            {currentBacklink && (
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={handleQuickAdd}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-blue-300 hover:text-blue-600"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  添加当前页面为新外链
                </button>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleFill}
                disabled={!hasForm || state === FloatingBallState.FILLING || !selectedProfileId}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {state === FloatingBallState.FILLING ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    填充中...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    一键填充
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FloatingPanel;
