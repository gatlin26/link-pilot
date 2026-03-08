import React from 'react';
import type { CollectedBacklink } from '@extension/shared';
import { BacklinkStatus, opportunityConverterService } from '@extension/shared';
import { backlinkStorage, opportunityStorage } from '@extension/storage';

interface BacklinkListProps {
  backlinks: CollectedBacklink[];
  onRefresh: () => void;
}

export const BacklinkList: React.FC<BacklinkListProps> = ({ backlinks, onRefresh }) => {
  const [converting, setConverting] = React.useState<string | null>(null);

  const handleConvert = async (backlink: CollectedBacklink) => {
    try {
      setConverting(backlink.id);

      const existing = await opportunityStorage.getByBacklinkId(backlink.id);
      if (existing) {
        alert('该外链已转为机会，无需重复转换');
        return;
      }

      const opportunity = await opportunityConverterService.forceConvert(backlink, '手动转换');
      await opportunityStorage.add(opportunity);
      await backlinkStorage.update(backlink.id, { status: BacklinkStatus.CONVERTED });
      alert('转换成功！');
      onRefresh();
    } catch (error) {
      alert(`转换失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setConverting(null);
    }
  };

  const handleOpenUrl = (url: string) => {
    chrome.tabs.create({ url });
  };

  const getLinkTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      blog_comment: '博客评论',
      guest_post: '客座文章',
      forum: '论坛',
      directory: '目录',
      resource_page: '资源页',
      unknown: '待识别',
    };
    return type ? labels[type] || type : '-';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      collected: '已收集',
      synced: '已同步',
      sync_failed: '同步失败',
      reviewed: '已审核',
      converted: '已转换',
      archived: '已归档',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      collected: 'bg-blue-100 text-blue-800',
      synced: 'bg-green-100 text-green-800',
      sync_failed: 'bg-red-100 text-red-800',
      reviewed: 'bg-yellow-100 text-yellow-800',
      converted: 'bg-purple-100 text-purple-800',
      archived: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (backlinks.length === 0) {
    return <div className="text-center py-12 text-gray-500">暂无数据</div>;
  }

  return (
    <div className="space-y-4 overflow-y-auto pr-2">
      {backlinks.map(backlink => (
        <div key={backlink.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(backlink.status)}`}>
                  {getStatusLabel(backlink.status)}
                </span>
                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  {getLinkTypeLabel(backlink.link_type)}
                </span>
                <span className="px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  评分: {backlink.context_match_score ?? 0}
                </span>
              </div>
              <h3 className="font-medium text-sm mb-1 break-words">{backlink.page_title || backlink.referring_domain}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 break-all">
                目标:{' '}
                <a href={backlink.target_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {backlink.target_url}
                </a>
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                引用:{' '}
                <a href={backlink.referring_page_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {backlink.referring_page_url}
                </a>
              </p>
              {backlink.anchor_text && <p className="text-xs text-gray-500 mt-1 break-words">锚文本: {backlink.anchor_text}</p>}
              {backlink.context_match_note && <p className="text-xs text-gray-500 mt-1 break-words">说明: {backlink.context_match_note}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleOpenUrl(backlink.referring_page_url)}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 whitespace-nowrap"
              >
                打开
              </button>
              <button
                onClick={() => handleConvert(backlink)}
                disabled={converting === backlink.id}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 whitespace-nowrap"
              >
                {converting === backlink.id ? '转换中...' : '转为机会'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
