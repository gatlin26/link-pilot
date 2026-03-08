import React, { useState } from 'react';
import { cn } from '@extension/ui';
import type { WebsiteConfig } from '@extension/shared';

interface AutoCommentProps {
  configs: WebsiteConfig[];
  isLight: boolean;
}

export const AutoComment: React.FC<AutoCommentProps> = ({ configs, isLight }) => {
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [comment, setComment] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!selectedConfig) {
      alert('请先选择网站配置');
      return;
    }

    try {
      setGenerating(true);
      // TODO: 实现评论生成逻辑
      // 这里可以调用 AI API 或使用模板生成评论
      const config = configs.find(c => c.id === selectedConfig);
      if (config) {
        const generatedComment = `感谢分享！${config.name} 看起来很不错。${config.description || ''}`;
        setComment(generatedComment);
      }
    } catch (error) {
      alert(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!comment) {
      alert('没有可复制的评论');
      return;
    }
    navigator.clipboard.writeText(comment);
    alert('评论已复制到剪贴板');
  };

  const handleClear = () => {
    setComment('');
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'p-4 rounded-lg',
          isLight ? 'bg-white border border-gray-200' : 'bg-gray-800 border border-gray-700',
        )}
      >
        <h3 className={cn('text-sm font-semibold mb-3', isLight ? 'text-gray-900' : 'text-gray-100')}>
          选择网站配置
        </h3>
        <select
          value={selectedConfig}
          onChange={e => setSelectedConfig(e.target.value)}
          className={cn(
            'w-full px-3 py-2 border rounded-md',
            isLight
              ? 'bg-white border-gray-300'
              : 'bg-gray-700 border-gray-600 text-gray-100',
          )}
        >
          <option value="">请选择网站</option>
          {configs
            .filter(c => c.enabled)
            .map(config => (
              <option key={config.id} value={config.id}>
                {config.name}
              </option>
            ))}
        </select>
        {configs.filter(c => c.enabled).length === 0 && (
          <p className={cn('text-xs mt-2', isLight ? 'text-gray-500' : 'text-gray-400')}>
            暂无可用的网站配置，请先在"我的网站"中添加
          </p>
        )}
      </div>

      <div
        className={cn(
          'p-4 rounded-lg',
          isLight ? 'bg-white border border-gray-200' : 'bg-gray-800 border border-gray-700',
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn('text-sm font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
            评论
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={!comment}
              className={cn(
                'text-xs px-3 py-1 rounded',
                comment
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed',
              )}
            >
              复制
            </button>
            <button
              onClick={handleClear}
              disabled={!comment}
              className={cn(
                'text-xs px-3 py-1 rounded',
                comment
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed',
              )}
            >
              清空
            </button>
          </div>
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="生成的评论将显示在这里，您可以进行修改"
          className={cn(
            'w-full px-3 py-2 border rounded-md resize-none',
            isLight
              ? 'bg-white border-gray-300'
              : 'bg-gray-700 border-gray-600 text-gray-100',
          )}
          rows={6}
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating || !selectedConfig}
        className={cn(
          'w-full py-3 rounded-lg font-medium transition-colors',
          generating || !selectedConfig
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white',
        )}
      >
        {generating ? '生成中...' : '生成评论'}
      </button>

      <div
        className={cn(
          'p-4 rounded-lg text-center',
          isLight ? 'bg-blue-50 border border-blue-200' : 'bg-blue-900/30 border border-blue-700',
        )}
      >
        <div className={cn('text-sm mb-2', isLight ? 'text-blue-900' : 'text-blue-100')}>
          微信打赏
        </div>
        <div className={cn('text-xs', isLight ? 'text-blue-700' : 'text-blue-300')}>
          未登录
        </div>
        <div className={cn('text-xs mt-1', isLight ? 'text-blue-600' : 'text-blue-400')}>
          请输入您的 API Key 进行登录
        </div>
      </div>
    </div>
  );
};
