import React, { useState } from 'react';
import { cn } from '@extension/ui';
import type { WebsiteConfig, WebsiteGroup } from '@extension/shared';

interface WebsiteConfigListProps {
  configs: WebsiteConfig[];
  groups: WebsiteGroup[];
  onEdit: (config: WebsiteConfig) => void;
  onDelete: (id: string) => void;
}

export const WebsiteConfigList: React.FC<WebsiteConfigListProps> = ({
  configs,
  groups,
  onEdit,
  onDelete,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConfigs = configs.filter(config => {
    const matchesGroup = selectedGroup === 'all' || config.group_id === selectedGroup;
    const matchesSearch =
      !searchQuery ||
      config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.url.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="搜索网站..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
        />
        <select
          value={selectedGroup}
          onChange={e => setSelectedGroup(e.target.value)}
          className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="all">所有分类</option>
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {filteredConfigs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无网站配置</div>
        ) : (
          filteredConfigs.map(config => (
            <div
              key={config.id}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{config.name}</h3>
                  {!config.enabled && (
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                      已禁用
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{config.url}</p>
                {config.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    {config.description}
                  </p>
                )}
                {config.categories.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {config.categories.map(cat => (
                      <span
                        key={cat}
                        className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(config)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  编辑
                </button>
                <button
                  onClick={() => onDelete(config.id)}
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
