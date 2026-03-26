/**
 * 外链管理面板 — 卡片式布局
 * 支持筛选、搜索、新增、AI 抓取、动态字段展示
 */

import { DynamicFieldEditor } from './DynamicFieldEditor.js';
import { LinkCard } from './LinkCard.js';
import { LinkAvailabilityStatus, LinkSiteType } from '@extension/shared';
import { useState, useMemo } from 'react';
import type { ExternalLink, ExternalLinkMetadata, DynamicFieldDefinition, DynamicFieldValue } from '@extension/shared';

interface ExternalLinksPanelProps {
  links: ExternalLink[];
  metadataMap: Record<string, ExternalLinkMetadata>;
  onAddLink: (link: ExternalLink) => Promise<void>;
  onDeleteLink: (id: string) => Promise<void>;
  onCollectMetadata: (url: string) => Promise<ExternalLinkMetadata | null>;
  onCheckAvailability: (id: string) => void;
  onToggleFavorite: (id: string) => Promise<void>;
}

const ExternalLinksPanel = (props: ExternalLinksPanelProps) => {
  const { links, metadataMap, onAddLink, onDeleteLink, onCollectMetadata, onCheckAvailability, onToggleFavorite } =
    props;

  const [search, setSearch] = useState('');
  const [siteTypeFilter, setSiteTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [favFilter, setFavFilter] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [collectedMetadata, setCollectedMetadata] = useState<ExternalLinkMetadata | null>(null);
  const [fieldValues, setFieldValues] = useState<DynamicFieldValue[]>([]);

  const filteredLinks = useMemo(
    () =>
      links.filter(link => {
        const matchesSearch = !search || link.domain.includes(search) || link.url.includes(search);
        const matchesType = siteTypeFilter === 'all' || link.siteType === siteTypeFilter;
        const matchesStatus = statusFilter === 'all' || link.status === statusFilter;
        const matchesFav = !favFilter || link.favorite;
        return matchesSearch && matchesType && matchesStatus && matchesFav;
      }),
    [links, search, siteTypeFilter, statusFilter, favFilter],
  );

  const handleCollect = async () => {
    if (!newUrl.trim()) return;
    setCollecting(true);
    try {
      const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
      const metadata = await onCollectMetadata(url);
      setCollectedMetadata(metadata);
      if (metadata?.dataFields) {
        setFieldValues(
          metadata.dataFields.map(f => ({
            key: f.key,
            value: f.defaultValue || '',
            updatedBy: 'ai' as const,
            updatedAt: new Date().toISOString(),
          })),
        );
      }
    } finally {
      setCollecting(false);
    }
  };

  const handleSave = async () => {
    if (!newUrl.trim()) return;
    const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    const link: ExternalLink = {
      id: `ext-link-${Date.now()}`,
      groupId: 'default',
      url,
      domain: new URL(url).hostname,
      status: LinkAvailabilityStatus.UNKNOWN,
      siteType: collectedMetadata?.detectedSiteType || LinkSiteType.OTHER,
      favorite: false,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onAddLink(link);
    setNewUrl('');
    setShowAddForm(false);
    setCollectedMetadata(null);
    setFieldValues([]);
  };

  const handleAddField = () => {
    const newField: DynamicFieldDefinition = {
      key: `custom_field_${Date.now()}`,
      label: '新字段',
      type: 'text',
      source: 'user',
      required: false,
      visible: true,
      group: 'custom',
      order: (collectedMetadata?.dataFields?.length ?? 0) + fieldValues.length,
    };
    setCollectedMetadata(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        dataFields: [...(prev.dataFields || []), newField],
      };
    });
  };

  const handleRemoveField = (key: string) => {
    setCollectedMetadata(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        dataFields: (prev.dataFields || []).filter(f => f.key !== key),
      };
    });
    setFieldValues(prev => prev.filter(v => v.key !== key));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">外链管理</h2>
          <p className="mt-1 text-sm text-gray-500">共 {filteredLinks.length} 条外链</p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
          {showAddForm ? '关闭' : '+ 新增外链'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索 URL / 域名..."
          className="min-w-48 flex-1 rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <select
          value={siteTypeFilter}
          onChange={e => setSiteTypeFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700">
          <option value="all">全部类型</option>
          {Object.values(LinkSiteType).map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700">
          <option value="all">全部状态</option>
          {Object.values(LinkAvailabilityStatus).map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={favFilter} onChange={e => setFavFilter(e.target.checked)} />
          仅收藏
        </label>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="space-y-4 rounded-xl border bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="font-semibold">新增外链</h3>
          <div className="flex gap-3">
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="输入外链 URL"
              className="flex-1 rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
            <button
              onClick={handleCollect}
              disabled={collecting || !newUrl.trim()}
              className="rounded-lg bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 disabled:opacity-50">
              {collecting ? '采集中...' : 'AI 抓取'}
            </button>
          </div>

          {collectedMetadata && (
            <div className="space-y-3">
              <div className="space-y-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{collectedMetadata.siteName || collectedMetadata.pageTitle}</span>
                  <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">AI 已分析</span>
                </div>
                {collectedMetadata.summary && <p className="text-sm text-gray-500">{collectedMetadata.summary}</p>}
                {collectedMetadata.analysisSummary && (
                  <p className="text-xs text-gray-400">{collectedMetadata.analysisSummary}</p>
                )}
                {collectedMetadata.typeConfidence !== undefined && (
                  <p className="text-xs text-purple-500">
                    识别置信度: {(collectedMetadata.typeConfidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>

              {collectedMetadata.dataFields && collectedMetadata.dataFields.length > 0 && (
                <DynamicFieldEditor
                  fields={collectedMetadata.dataFields}
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
              保存外链
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

      {/* Card Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredLinks.length === 0 && !showAddForm && (
          <div className="col-span-full py-12 text-center text-gray-500">
            暂无外链，请点击上方&quot;新增外链&quot;添加
          </div>
        )}
        {filteredLinks.map(link => (
          <LinkCard
            key={link.id}
            link={link}
            metadata={metadataMap[link.id]}
            onOpen={() => {}}
            onEdit={() => {}}
            onDelete={() => onDeleteLink(link.id)}
            onFavorite={() => onToggleFavorite(link.id)}
            onCheckAvailability={id => onCheckAvailability(id)}
            onReanalyze={() => {}}
          />
        ))}
      </div>
    </div>
  );
};

export { ExternalLinksPanel };
