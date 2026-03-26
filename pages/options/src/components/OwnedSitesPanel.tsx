/**
 * "我的网站"管理面板
 * 支持新增网站、AI 抓取、可视化字段编辑、卡片列表展示
 */

import { DynamicFieldEditor } from './DynamicFieldEditor.js';
import { generateOwnedSiteMetadata } from '@extension/shared';
import { useState } from 'react';
import type { OwnedSite, OwnedSiteMetadata, OwnedSiteProfile, DynamicFieldValue } from '@extension/shared';

interface OwnedSitesPanelProps {
  sites: OwnedSite[];
  metadataMap: Record<string, OwnedSiteMetadata>;
  profiles: Record<string, OwnedSiteProfile>;
  onAddSite: (site: OwnedSite) => Promise<void>;
  onDeleteSite: (id: string) => Promise<void>;
}

const OwnedSitesPanel = (props: OwnedSitesPanelProps) => {
  const { sites, metadataMap, profiles, onAddSite, onDeleteSite } = props;

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [collectedMetadata, setCollectedMetadata] = useState<OwnedSiteMetadata | null>(null);
  const [fieldValues, setFieldValues] = useState<DynamicFieldValue[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  const handleCollect = async () => {
    if (!newUrl.trim()) return;
    setCollecting(true);
    try {
      const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
      const metadata = await generateOwnedSiteMetadata(url);
      setCollectedMetadata(metadata);
      if (metadata) {
        setFieldValues(
          (metadata.extractedFields || []).map(f => ({
            key: f.key,
            value: f.defaultValue || '',
            updatedBy: 'ai' as const,
            updatedAt: new Date().toISOString(),
          })),
        );
        setDisplayName(metadata.siteName || '');
        setCustomDesc(metadata.fullDescription || '');
      }
    } finally {
      setCollecting(false);
    }
  };

  const handleSave = async () => {
    if (!newUrl.trim()) return;
    const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    const site: OwnedSite = {
      id: `owned-site-${Date.now()}`,
      groupId: 'default',
      url,
      domain: new URL(url).hostname,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onAddSite(site);
    setNewUrl('');
    setShowAddForm(false);
    setCollectedMetadata(null);
    setFieldValues([]);
  };

  const handleAddField = () => {
    if (!collectedMetadata) return;
    const newField = {
      key: `custom_field_${Date.now()}`,
      label: '新字段',
      type: 'text' as const,
      source: 'user' as const,
      required: false,
      visible: true,
      group: 'custom' as const,
      order: (collectedMetadata.extractedFields?.length ?? 0) + fieldValues.length,
    };
    setCollectedMetadata({
      ...collectedMetadata,
      extractedFields: [...(collectedMetadata.extractedFields || []), newField],
    });
  };

  const handleRemoveField = (key: string) => {
    if (!collectedMetadata) return;
    setCollectedMetadata({
      ...collectedMetadata,
      extractedFields: (collectedMetadata.extractedFields || []).filter(f => f.key !== key),
    });
    setFieldValues(prev => prev.filter(v => v.key !== key));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">我的网站</h2>
          <p className="mt-1 text-sm text-gray-500">管理你的网站资料，用于后续评论和提交</p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
          {showAddForm ? '关闭' : '+ 新增网站'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="space-y-4 rounded-xl border bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="font-semibold">新增网站</h3>

          <div className="flex gap-3">
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="输入网站 URL"
              className="flex-1 rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
            <button
              onClick={handleCollect}
              disabled={collecting || !newUrl.trim()}
              className="rounded-lg bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 disabled:opacity-50">
              {collecting ? 'AI 采集中...' : 'AI 抓取'}
            </button>
          </div>

          {collectedMetadata && (
            <div className="space-y-4">
              <div className="space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  {collectedMetadata.faviconUrl && (
                    <img src={collectedMetadata.faviconUrl} className="h-6 w-6" alt="favicon" />
                  )}
                  <div>
                    <div className="font-medium">{collectedMetadata.siteName || collectedMetadata.siteTitle}</div>
                    <div className="text-xs text-gray-400">{collectedMetadata.shortDescription}</div>
                  </div>
                </div>

                {collectedMetadata.categories && collectedMetadata.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {collectedMetadata.categories.map(cat => (
                      <span key={cat} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                {collectedMetadata.keywords && collectedMetadata.keywords.length > 0 && (
                  <div className="text-xs text-gray-500">关键词: {collectedMetadata.keywords.join(', ')}</div>
                )}

                {collectedMetadata.analysisSummary && (
                  <div className="text-xs text-purple-600">{collectedMetadata.analysisSummary}</div>
                )}
              </div>

              <div>
                <label htmlFor="display-name" className="mb-1 block text-sm font-medium">
                  显示名称
                </label>
                <input
                  id="display-name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
              <div>
                <label htmlFor="custom-desc" className="mb-1 block text-sm font-medium">
                  网站描述
                </label>
                <textarea
                  id="custom-desc"
                  value={customDesc}
                  onChange={e => setCustomDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>

              {collectedMetadata.extractedFields && collectedMetadata.extractedFields.length > 0 && (
                <DynamicFieldEditor
                  fields={collectedMetadata.extractedFields}
                  values={fieldValues}
                  onValuesChange={setFieldValues}
                  onFieldToggle={() => {}}
                  onFieldUpdate={() => {}}
                  onAddField={handleAddField}
                  onRemoveField={handleRemoveField}
                />
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!newUrl.trim()}
              className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50">
              保存网站
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewUrl('');
                setCollectedMetadata(null);
                setFieldValues([]);
              }}
              className="rounded-lg bg-gray-200 px-4 py-2 dark:bg-gray-700">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Sites List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sites.length === 0 && !showAddForm && (
          <div className="col-span-full py-12 text-center text-gray-500">
            暂无网站，请点击上方&quot;新增网站&quot;添加
          </div>
        )}
        {sites.map(site => {
          const metadata = metadataMap[site.id];
          const profile = profiles[site.id];
          return (
            <div key={site.id} className="rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {metadata?.faviconUrl && <img src={metadata.faviconUrl} className="h-5 w-5" alt="favicon" />}
                  <div>
                    <div className="font-semibold">{profile?.displayName || metadata?.siteName || site.domain}</div>
                    <div className="truncate text-xs text-blue-500">{site.url}</div>
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    site.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {site.enabled ? '启用' : '禁用'}
                </span>
              </div>
              {metadata?.shortDescription && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-500">{metadata.shortDescription}</p>
              )}
              {metadata?.categories && metadata.categories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {metadata.categories.map(cat => (
                    <span
                      key={cat}
                      className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2 border-t pt-2 dark:border-gray-700">
                <button className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600">
                  编辑
                </button>
                <button
                  onClick={() => onDeleteSite(site.id)}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-500 hover:bg-red-100">
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { OwnedSitesPanel };
