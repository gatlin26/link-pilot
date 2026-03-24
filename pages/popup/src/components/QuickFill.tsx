import React, { useEffect, useState } from 'react';
import { sendMessageToTabSafely } from '@extension/shared';
import { cn } from '@extension/ui';

interface PageInfo {
  title: string;
  url: string;
  registrationDate?: string;
  robotsTag: string;
  backlinkManaged: boolean;
}

interface QuickFillProps {
  isLight: boolean;
}

export const QuickFill: React.FC<QuickFillProps> = ({ isLight }) => {
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [formDetected, setFormDetected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);

  useEffect(() => {
    const loadPageInfo = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.url) {
          setLoading(false);
          return;
        }

        // 获取页面信息
        const response = await sendMessageToTabSafely(tab.id, {
          type: 'GET_PAGE_INFO',
        });

        if (response?.success) {
          const quickFillResponse = response as typeof response & {
            pageInfo?: PageInfo;
            formDetected?: boolean;
          };
          setPageInfo(quickFillResponse.pageInfo ?? null);
          setFormDetected(Boolean(quickFillResponse.formDetected));
        }
      } catch (error) {
        console.error('获取页面信息失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPageInfo();
  }, []);

  const handleQuickFill = async () => {
    try {
      setFilling(true);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      const response = await sendMessageToTabSafely(tab.id, {
        type: 'QUICK_FILL_FORM',
      });

      if (response?.success) {
        alert('表单填充成功');
      } else {
        alert(`填充失败: ${response?.error || '未知错误'}`);
      }
    } catch (error) {
      alert(`填充失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setFilling(false);
    }
  };

  const handleOpenBacklinkManager = () => {
    chrome.runtime.openOptionsPage();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!pageInfo) {
    return (
      <div className="text-center py-8">
        <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
          无法获取页面信息
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页面信息 */}
      <div
        className={cn(
          'p-4 rounded-lg',
          isLight ? 'bg-white border border-gray-200' : 'bg-gray-800 border border-gray-700',
        )}
      >
        <h3 className={cn('text-sm font-semibold mb-3', isLight ? 'text-gray-900' : 'text-gray-100')}>
          当前页面
        </h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>标题:</span>
            <span className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {pageInfo.title || 'New Tab'}
            </span>
          </div>
          {pageInfo.registrationDate && (
            <div className="flex justify-between">
              <span className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>注册时间:</span>
              <span className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
                {pageInfo.registrationDate}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Robots Tag:</span>
            <span
              className={cn(
                'font-medium',
                pageInfo.robotsTag === 'Missing'
                  ? 'text-red-600'
                  : isLight
                    ? 'text-gray-900'
                    : 'text-gray-100',
              )}
            >
              {pageInfo.robotsTag}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>外链管理状态:</span>
            <span className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {pageInfo.backlinkManaged ? '未添加至管理库' : '未添加至管理库'}
            </span>
          </div>
        </div>
      </div>

      {/* 表单检测 */}
      <div
        className={cn(
          'p-4 rounded-lg',
          isLight ? 'bg-white border border-gray-200' : 'bg-gray-800 border border-gray-700',
        )}
      >
        <h3 className={cn('text-sm font-semibold mb-3', isLight ? 'text-gray-900' : 'text-gray-100')}>
          表单检测
        </h3>
        <div className="text-xs">
          <span className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>状态: </span>
          <span
            className={cn(
              'font-medium',
              formDetected
                ? 'text-green-600'
                : isLight
                  ? 'text-gray-900'
                  : 'text-gray-100',
            )}
          >
            {formDetected ? '未检测到可填充表单' : '未检测到可填充表单'}
          </span>
        </div>
      </div>

      {/* 当前外链记录 */}
      <div
        className={cn(
          'p-4 rounded-lg',
          isLight ? 'bg-white border border-gray-200' : 'bg-gray-800 border border-gray-700',
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn('text-sm font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
            当前外链记录
          </h3>
          <button
            onClick={handleOpenBacklinkManager}
            className={cn(
              'text-xs px-2 py-1 rounded',
              isLight
                ? 'text-blue-600 hover:bg-blue-50'
                : 'text-blue-400 hover:bg-blue-900/30',
            )}
          >
            去外链管理
          </button>
        </div>
        <div className="text-center py-4">
          <div className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
            暂无当前外链记录
          </div>
          <div className={cn('text-xs mt-1', isLight ? 'text-gray-500' : 'text-gray-500')}>
            请前往"外链管理"页面选择一个外链，并点击"打开外链"按钮。
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      {formDetected && (
        <button
          onClick={handleQuickFill}
          disabled={filling}
          className={cn(
            'w-full py-3 rounded-lg font-medium transition-colors',
            filling
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white',
          )}
        >
          {filling ? '填充中...' : '开始填表'}
        </button>
      )}
    </div>
  );
};
