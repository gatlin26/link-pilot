/**
 * QuickFillCard.tsx
 * 快捷填充卡片组件 - 显示智能预测结果，提供一键填充功能
 * @author Link Pilot Team
 * @date 2026-03-13
 */

import { useState, useMemo } from 'react';
import { WebsiteProfile, ManagedBacklink } from '@extension/shared';
import { cn } from '@extension/ui';
import { buildCommentCandidates } from '@extension/shared';

interface QuickFillCardProps {
  predictedBacklink: ManagedBacklink | null;
  matchConfidence: number;
  alternativeMatches: ManagedBacklink[];
  profiles: WebsiteProfile[];
  pageState: {
    form_detected: boolean;
    form_confidence: number;
    url: string;
  } | null;
  onFill: (profileId: string, comment: string) => Promise<void>;
  onSwitchBacklink: (backlinkId: string) => void;
  onOpenFullBacklinks: () => void;
  isLight?: boolean;
}

export const QuickFillCard: React.FC<QuickFillCardProps> = ({
  predictedBacklink,
  matchConfidence,
  alternativeMatches,
  profiles,
  pageState,
  onFill,
  onSwitchBacklink,
  onOpenFullBacklinks,
  isLight = true,
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [customComment, setCustomComment] = useState('');
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);
  const [fillSuccess, setFillSuccess] = useState(false);
  const hasMatchedBacklink = Boolean(predictedBacklink);

  const enabledProfiles = useMemo(() => profiles.filter(p => p.enabled), [profiles]);
  const selectedProfile = useMemo(
    () => enabledProfiles.find(p => p.id === selectedProfileId) ?? enabledProfiles[0] ?? null,
    [enabledProfiles, selectedProfileId]
  );

  const generatedComments = useMemo(() => {
    if (!selectedProfile || !pageState) return [];
    return buildCommentCandidates(selectedProfile, pageState as any, predictedBacklink);
  }, [selectedProfile, pageState, predictedBacklink]);

  const confidenceLevel = useMemo(() => {
    if (matchConfidence >= 80) return { color: 'green', label: '高' };
    if (matchConfidence >= 50) return { color: 'yellow', label: '中' };
    return { color: 'red', label: '低' };
  }, [matchConfidence]);

  const handleFill = async () => {
    if (!selectedProfile) {
      setFillError('请先选择网站资料');
      return;
    }

    setIsFilling(true);
    setFillError(null);
    setFillSuccess(false);

    try {
      const comment = customComment.trim() || generatedComments[0] || '';
      await onFill(selectedProfile.id, comment);
      setFillSuccess(true);
      setTimeout(() => setFillSuccess(false), 2000);
    } catch (error) {
      setFillError(error instanceof Error ? error.message : '填充失败');
    } finally {
      setIsFilling(false);
    }
  };

  const handleUseGeneratedComment = (index: number) => {
    setCustomComment(generatedComments[index] || '');
  };

  return (
    <div
      className={cn(
        'p-4 rounded-lg border',
        isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
      )}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className={cn('text-sm font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
          快捷填充
        </h2>
        <div className="flex items-center gap-2">
          {hasMatchedBacklink ? (
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                confidenceLevel.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                confidenceLevel.color === 'yellow' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                confidenceLevel.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              )}
            >
              匹配度 {matchConfidence}%
            </span>
          ) : (
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-700 text-slate-200'
              )}
            >
              当前页直填
            </span>
          )}
        </div>
      </div>

      {/* 预测结果横幅 */}
      {predictedBacklink ? (
        <div
          className={cn(
            'mb-4 p-3 rounded-lg border',
            isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-700'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className={cn('text-sm font-medium truncate', isLight ? 'text-blue-900' : 'text-blue-200')}>
                {predictedBacklink.domain}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5">
                {predictedBacklink.url}
              </div>
            </div>
            {predictedBacklink.note && (
              <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {predictedBacklink.note}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'mb-4 p-3 rounded-lg border text-sm',
            isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-emerald-900/20 border-emerald-700 text-emerald-200'
          )}
        >
          当前页面没有匹配到外链也可以直接填表。系统会读取当前页面标题、描述和你的网站资料来生成内容。
        </div>
      )}

      {/* 网站资料选择 */}
      <div className="mb-4">
        <label
          className={cn('block text-xs mb-1.5', isLight ? 'text-gray-600' : 'text-gray-400')}
        >
          网站资料
        </label>
        {enabledProfiles.length === 0 ? (
          <div className="text-sm text-gray-500 py-2">暂无启用的网站资料</div>
        ) : (
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className={cn(
              'w-full px-3 py-2 rounded border text-sm',
              isLight
                ? 'bg-white border-gray-300 text-gray-900'
                : 'bg-gray-900 border-gray-700 text-gray-100'
            )}
          >
            {enabledProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.domain})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 评论内容 */}
      <div className="mb-4">
        <label
          className={cn('block text-xs mb-1.5', isLight ? 'text-gray-600' : 'text-gray-400')}
        >
          评论内容
        </label>
        <div className={cn('text-[11px] mb-2', isLight ? 'text-gray-500' : 'text-gray-400')}>
          留空时会优先使用 AI 结合当前页面内容和网站资料自动生成；已填写时会按你的内容填充。
        </div>
        {generatedComments.length > 0 && (
          <div className="mb-2">
            <select
              onChange={(e) => handleUseGeneratedComment(Number(e.target.value))}
              className={cn(
                'w-full px-3 py-1.5 rounded border text-xs mb-2',
                isLight
                  ? 'bg-gray-50 border-gray-200 text-gray-700'
                  : 'bg-gray-800 border-gray-700 text-gray-300'
              )}
            >
              <option value="">使用推荐内容（可选）...</option>
              {generatedComments.map((comment, index) => (
                <option key={index} value={index}>
                  {comment.slice(0, 50)}{comment.length > 50 ? '...' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <textarea
          value={customComment}
          onChange={(e) => setCustomComment(e.target.value)}
          placeholder={generatedComments[0] || '留空则自动生成评论'}
          rows={3}
          className={cn(
            'w-full px-3 py-2 rounded border text-sm resize-none',
            isLight
              ? 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              : 'bg-gray-900 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
          )}
        />
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={handleFill}
          disabled={isFilling || !selectedProfile}
          className={cn(
            'py-2.5 rounded text-sm font-medium transition-colors disabled:opacity-50',
            isLight
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          )}
        >
          {isFilling ? (
            <span className="flex items-center justify-center gap-1">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              填充中...
            </span>
          ) : (
            'AI 一键填表'
          )}
        </button>
        <button
          onClick={() => {
            if (hasMatchedBacklink) {
              setShowAlternatives(!showAlternatives);
              return;
            }
            onOpenFullBacklinks();
          }}
          disabled={hasMatchedBacklink ? alternativeMatches.length === 0 : false}
          className={cn(
            'py-2.5 rounded text-sm font-medium transition-colors disabled:opacity-50',
            isLight
              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          )}
        >
          {hasMatchedBacklink ? `切换外链 (${alternativeMatches.length})` : '可选：关联外链'}
        </button>
      </div>

      {/* 状态提示 */}
      {fillError && (
        <div className="mb-3 p-2 rounded text-xs bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {fillError}
        </div>
      )}
      {fillSuccess && (
        <div className="mb-3 p-2 rounded text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200">
          填充成功！
        </div>
      )}

      {/* 备选外链列表 */}
      {hasMatchedBacklink && showAlternatives && alternativeMatches.length > 0 && (
        <div className="border-t pt-3">
          <div className="text-xs text-gray-500 mb-2">其他匹配结果：</div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {alternativeMatches.map((backlink) => (
              <button
                key={backlink.id}
                onClick={() => {
                  onSwitchBacklink(backlink.id);
                  setShowAlternatives(false);
                }}
                className={cn(
                  'w-full p-2 rounded text-left text-xs transition-colors',
                  isLight
                    ? 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                    : 'bg-gray-900/40 hover:bg-gray-800 border border-gray-700'
                )}
              >
                <div className="font-medium truncate">{backlink.domain}</div>
                <div className="text-gray-500 truncate">{backlink.url}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 页面状态提示 */}
      {!pageState?.form_detected && (
        <div
          className={cn(
            'mt-3 p-2 rounded text-xs',
            isLight ? 'bg-yellow-50 text-yellow-700' : 'bg-yellow-900/30 text-yellow-200'
          )}
        >
          当前状态还没识别到表单，但你仍然可以点击“AI 一键填表”强制重试检测与填充。
        </div>
      )}
    </div>
  );
};

export default QuickFillCard;
