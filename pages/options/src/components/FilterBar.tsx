import React from 'react';
import { OpportunityStatus } from '@extension/shared';
import type { BacklinkFilters, OpportunityFilters } from '../hooks/useFilters';

interface BacklinkFilterBarProps {
  filters: BacklinkFilters;
  onFiltersChange: (filters: BacklinkFilters) => void;
  batchIds: string[];
}

export const BacklinkFilterBar: React.FC<BacklinkFilterBarProps> = ({ filters, onFiltersChange, batchIds }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">链接类型</label>
          <select
            value={filters.linkType || ''}
            onChange={e => onFiltersChange({ ...filters, linkType: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">全部</option>
            <option value="blog_comment">博客评论</option>
            <option value="guest_post">客座文章</option>
            <option value="forum">论坛</option>
            <option value="directory">目录</option>
            <option value="resource_page">资源页</option>
            <option value="unknown">待识别</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">状态</label>
          <select
            value={filters.status || ''}
            onChange={e => onFiltersChange({ ...filters, status: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">全部</option>
            <option value="collected">已收集</option>
            <option value="synced">已同步</option>
            <option value="sync_failed">同步失败</option>
            <option value="reviewed">已审核</option>
            <option value="converted">已转换</option>
            <option value="archived">已归档</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">批次</label>
          <select
            value={filters.batchId || ''}
            onChange={e => onFiltersChange({ ...filters, batchId: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">全部</option>
            {batchIds.map(id => (
              <option key={id} value={id}>{id.slice(0, 8)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">最低评分</label>
          <input
            type="number"
            min="0"
            max="100"
            value={filters.minScore ?? ''}
            onChange={e => onFiltersChange({ ...filters, minScore: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="0-100"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">搜索 URL</label>
          <input
            type="text"
            value={filters.searchUrl || ''}
            onChange={e => onFiltersChange({ ...filters, searchUrl: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="输入 URL 关键词"
          />
        </div>
      </div>
    </div>
  );
};

interface OpportunityFilterBarProps {
  filters: OpportunityFilters;
  onFiltersChange: (filters: OpportunityFilters) => void;
  domains: string[];
}

export const OpportunityFilterBar: React.FC<OpportunityFilterBarProps> = ({ filters, onFiltersChange, domains }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">状态</label>
          <select
            value={filters.status || ''}
            onChange={e => onFiltersChange({ ...filters, status: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">全部</option>
            <option value={OpportunityStatus.NEW}>新建</option>
            <option value={OpportunityStatus.READY_TO_SUBMIT}>待提交</option>
            <option value={OpportunityStatus.SUBMITTED}>已提交</option>
            <option value={OpportunityStatus.REJECTED}>已拒绝</option>
            <option value={OpportunityStatus.ARCHIVED}>已归档</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">链接类型</label>
          <select
            value={filters.linkType || ''}
            onChange={e => onFiltersChange({ ...filters, linkType: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">全部</option>
            <option value="blog_comment">博客评论</option>
            <option value="guest_post">客座文章</option>
            <option value="forum">论坛</option>
            <option value="directory">目录</option>
            <option value="resource_page">资源页</option>
            <option value="unknown">待识别</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">域名</label>
          <select
            value={filters.domain || ''}
            onChange={e => onFiltersChange({ ...filters, domain: e.target.value || undefined })}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">全部</option>
            {domains.map(domain => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
