import React from 'react';
import type { Opportunity } from '@extension/shared';
import { OpportunityStatus } from '@extension/shared';
import { opportunityStorage } from '@extension/storage';

interface OpportunityListProps {
  opportunities: Opportunity[];
  onRefresh: () => void;
}

export const OpportunityList: React.FC<OpportunityListProps> = ({ opportunities, onRefresh }) => {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const handleSelectAll = () => {
    if (selectedIds.size === opportunities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(opportunities.map(o => o.id)));
    }
  };

  const handleSelect = (id: string) => {
    const nextSelected = new Set(selectedIds);
    if (nextSelected.has(id)) {
      nextSelected.delete(id);
    } else {
      nextSelected.add(id);
    }
    setSelectedIds(nextSelected);
  };

  const handleBatchOpen = () => {
    const selected = opportunities.filter(o => selectedIds.has(o.id));
    selected.forEach(opportunity => {
      chrome.tabs.create({ url: opportunity.url, active: false });
    });
  };

  const handleBatchMark = async (status: OpportunityStatus) => {
    try {
      for (const id of selectedIds) {
        await opportunityStorage.update(id, { status });
      }
      setSelectedIds(new Set());
      onRefresh();
    } catch (error) {
      alert(`批量标记失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleOpenUrl = (url: string) => {
    chrome.tabs.create({ url });
  };

  const handleMarkStatus = async (id: string, status: OpportunityStatus) => {
    try {
      await opportunityStorage.update(id, { status });
      onRefresh();
    } catch (error) {
      alert(`标记失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const getLinkTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      blog_comment: '博客评论',
      guest_post: '客座文章',
      forum: '论坛',
      directory: '目录',
      resource_page: '资源页',
      unknown: '待识别',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: OpportunityStatus) => {
    const labels: Record<OpportunityStatus, string> = {
      [OpportunityStatus.NEW]: '新建',
      [OpportunityStatus.READY_TO_SUBMIT]: '待提交',
      [OpportunityStatus.SUBMITTED]: '已提交',
      [OpportunityStatus.REJECTED]: '已拒绝',
      [OpportunityStatus.ARCHIVED]: '已归档',
      [OpportunityStatus.CONVERTED]: '已转化',
      [OpportunityStatus.DISCARDED]: '已丢弃',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: OpportunityStatus) => {
    const colors: Record<OpportunityStatus, string> = {
      [OpportunityStatus.NEW]: 'bg-blue-100 text-blue-800',
      [OpportunityStatus.READY_TO_SUBMIT]: 'bg-yellow-100 text-yellow-800',
      [OpportunityStatus.SUBMITTED]: 'bg-green-100 text-green-800',
      [OpportunityStatus.REJECTED]: 'bg-red-100 text-red-800',
      [OpportunityStatus.ARCHIVED]: 'bg-gray-100 text-gray-800',
      [OpportunityStatus.CONVERTED]: 'bg-purple-100 text-purple-800',
      [OpportunityStatus.DISCARDED]: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (opportunities.length === 0) {
    return <div className="text-center py-12 text-gray-500">暂无机会</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {selectedIds.size > 0 && (
        <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900 p-3 rounded-lg mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm">已选择 {selectedIds.size} 项</span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleBatchOpen} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                批量打开
              </button>
              <button
                onClick={() => handleBatchMark(OpportunityStatus.READY_TO_SUBMIT)}
                className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                标记待提交
              </button>
              <button
                onClick={() => handleBatchMark(OpportunityStatus.SUBMITTED)}
                className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              >
                标记已提交
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">
                取消选择
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 mb-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selectedIds.size === opportunities.length} onChange={handleSelectAll} className="rounded" />
          全选
        </label>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {opportunities.map(opportunity => (
          <div key={opportunity.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selectedIds.has(opportunity.id)} onChange={() => handleSelect(opportunity.id)} className="mt-1 rounded flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(opportunity.status)}`}>
                    {getStatusLabel(opportunity.status)}
                  </span>
                  <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    {getLinkTypeLabel(opportunity.link_type)}
                  </span>
                  <span className="px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    评分: {opportunity.context_match_score}
                  </span>
                </div>
                <h3 className="font-medium text-sm mb-1 break-words">{opportunity.domain}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 break-all">
                  <a href={opportunity.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {opportunity.url}
                  </a>
                </p>
                {opportunity.site_summary && <p className="text-xs text-gray-500 mt-1 break-words">{opportunity.site_summary}</p>}
                {opportunity.notes && <p className="text-xs text-gray-500 mt-1 italic break-words">{opportunity.notes}</p>}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => handleOpenUrl(opportunity.url)}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 whitespace-nowrap"
                >
                  打开
                </button>
                <select
                  value={opportunity.status}
                  onChange={e => handleMarkStatus(opportunity.id, e.target.value as OpportunityStatus)}
                  className="px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value={OpportunityStatus.NEW}>新建</option>
                  <option value={OpportunityStatus.READY_TO_SUBMIT}>待提交</option>
                  <option value={OpportunityStatus.SUBMITTED}>已提交</option>
                  <option value={OpportunityStatus.REJECTED}>已拒绝</option>
                  <option value={OpportunityStatus.ARCHIVED}>已归档</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
