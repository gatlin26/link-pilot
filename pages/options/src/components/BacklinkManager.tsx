import React, { useState } from 'react';
import { cn } from '@extension/ui';
import type { CollectedBacklink, BacklinkGroup } from '@extension/shared';

interface BacklinkManagerProps {
  backlinks: CollectedBacklink[];
  groups: BacklinkGroup[];
  onEdit: (backlink: CollectedBacklink) => void;
  onDelete: (id: string) => void;
  onOpenBacklink: (backlink: CollectedBacklink) => void;
}

export const BacklinkManager: React.FC<BacklinkManagerProps> = ({
  backlinks,
  groups,
  onEdit,
  onDelete,
  onOpenBacklink,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');

  const filteredBacklinks = backlinks.filter(backlink => {
    const matchesGroup =
      selectedGroup === 'all' || backlink.backlink_group_id === selectedGroup;
    const matchesSearch =
      !searchQuery ||
      backlink.target_url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      backlink.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      backlink.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesKeyword =
      !keywordFilter ||
      backlink.anchor_text.toLowerCase().includes(keywordFilter.toLowerCase()) ||
      backlink.page_title.toLowerCase().includes(keywordFilter.toLowerCase());
    return matchesGroup && matchesSearch && matchesKeyword;
  });

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">分组</label>
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="all">所有分组</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.backlink_count})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">搜索 URL 或 ID 或备注</label>
          <input
            type="text"
            placeholder="搜索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">关键词</label>
          <input
            type="text"
            placeholder="用逗号分隔，如：技术,编程,前端"
            value={keywordFilter}
            onChange={e => setKeywordFilter(e.target.value)}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>

      {/* 统计信息 */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-600 dark:text-gray-400">
          共 {filteredBacklinks.length} 条外链
          {selectedGroup !== 'all' && ` (分组: ${groups.find(g => g.id === selectedGroup)?.name})`}
        </div>
        <div className="text-blue-600 dark:text-blue-400">
          0/1000
        </div>
      </div>

      {/* 外链列表 */}
      <div className="space-y-2">
        {filteredBacklinks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="text-gray-600 dark:text-gray-400 mb-2">暂无外链</div>
            <div className="text-sm text-gray-500">
              点击上方添加按钮开始添加免费外链
            </div>
          </div>
        ) : (
          filteredBacklinks.map(backlink => (
            <div
              key={backlink.id}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-start justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium truncate">{backlink.page_title}</h3>
                  <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0">
                    {backlink.status}
                  </span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 truncate mb-1">
                  {backlink.target_url}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>域名: {backlink.target_domain}</span>
                  <span>收集时间: {new Date(backlink.collected_at).toLocaleDateString()}</span>
                </div>
                {backlink.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{backlink.notes}</p>
                )}
              </div>
              <div className="flex gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => onOpenBacklink(backlink)}
                  className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                >
                  打开外链
                </button>
                <button
                  onClick={() => onEdit(backlink)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  编辑
                </button>
                <button
                  onClick={() => onDelete(backlink.id)}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
