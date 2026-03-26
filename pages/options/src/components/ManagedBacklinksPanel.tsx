import { useMemo, useState } from 'react';
import type {
  ManagedBacklink,
  ManagedBacklinkGroup,
  ManagedBacklinkPricing,
  ManagedBacklinkSiteType,
} from '@extension/shared';

interface ManagedBacklinksPanelProps {
  backlinks: ManagedBacklink[];
  groups: ManagedBacklinkGroup[];
  uniqueByDomain: boolean;
  onSaveBacklink: (backlink: ManagedBacklink, isEditing: boolean) => Promise<void>;
  onDeleteBacklink: (id: string) => Promise<void>;
  onAddGroup: (name: string) => Promise<void>;
  onOpenBacklink: (backlinkId: string, queueIds: string[], groupId?: string) => Promise<void>;
  onOpenFiltered: (queueIds: string[], groupId?: string) => Promise<void>;
  onCollectBacklink?: (url: string) => Promise<void>;
}

const createEmptyBacklink = (): Partial<ManagedBacklink> => ({
  url: '',
  title: '',
  description: '',
  note: '',
  keywords: [],
  dr: undefined,
  as: undefined,
  site_type: 'blog_comment',
  pricing: 'free',
  language: '',
  is_available: true,
  flagged: false,
  group_id: 'default',
});

const siteTypeLabels: Record<ManagedBacklinkSiteType, string> = {
  blog_comment: 'Blog',
  ai_directory: 'AI 导航',
  tool_directory: '工具站',
  submission_form: '提交页',
  partner: '合作',
  other: '其他',
};

const pricingLabels: Record<ManagedBacklinkPricing, string> = {
  free: '免费',
  freemium: 'Freemium',
  paid: '付费',
  unknown: '未知',
};

export function ManagedBacklinksPanel({
  backlinks,
  groups,
  uniqueByDomain,
  onSaveBacklink,
  onDeleteBacklink,
  onAddGroup,
  onOpenBacklink,
  onOpenFiltered,
  onCollectBacklink,
}: ManagedBacklinksPanelProps) {
  const [editingBacklink, setEditingBacklink] = useState<ManagedBacklink | null>(null);
  const [draft, setDraft] = useState<Partial<ManagedBacklink>>(createEmptyBacklink());
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ManagedBacklinkSiteType>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [saving, setSaving] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const filteredBacklinks = useMemo(() => {
    let result = backlinks.filter(backlink => {
      const matchesGroup = selectedGroupId === 'all' || backlink.group_id === selectedGroupId;
      const matchesSearch =
        !search ||
        backlink.url.toLowerCase().includes(search.toLowerCase()) ||
        backlink.domain.toLowerCase().includes(search.toLowerCase()) ||
        (backlink.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (backlink.note ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || (backlink.site_type ?? 'blog_comment') === typeFilter;
      const isAvailable = backlink.is_available ?? true;
      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' ? isAvailable : !isAvailable);
      return matchesGroup && matchesSearch && matchesType && matchesAvailability;
    });

    if (uniqueByDomain) {
      const seen = new Set<string>();
      result = result.filter(backlink => {
        if (seen.has(backlink.domain)) {
          return false;
        }
        seen.add(backlink.domain);
        return true;
      });
    }

    return result;
  }, [availabilityFilter, backlinks, search, selectedGroupId, typeFilter, uniqueByDomain]);

  const beginCreate = () => {
    setEditingBacklink(null);
    setDraft(createEmptyBacklink());
  };

  const beginEdit = (backlink: ManagedBacklink) => {
    setEditingBacklink(backlink);
    setDraft({ ...backlink, keywords: [...backlink.keywords] });
  };

  const save = async () => {
    if (!draft.url?.trim()) {
      alert('请填写外链 URL');
      return;
    }

    let domain = '';
    try {
      domain = new URL(draft.url).hostname;
    } catch {
      alert('请输入合法的外链 URL');
      return;
    }

    setSaving(true);
    try {
      await onSaveBacklink(
        {
          id: editingBacklink?.id ?? `managed-backlink-${Date.now()}`,
          group_id: draft.group_id || 'default',
          url: draft.url.trim(),
          domain,
          title: draft.title?.trim() || undefined,
          description: draft.description?.trim() || undefined,
          site_type: draft.site_type ?? 'blog_comment',
          pricing: draft.pricing ?? 'free',
          language: draft.language?.trim() || undefined,
          is_available: draft.is_available ?? true,
          note: draft.note?.trim() || undefined,
          keywords: (draft.keywords ?? []).map(keyword => keyword.trim()).filter(Boolean),
          dr: draft.dr,
          as: draft.as,
          flagged: draft.flagged ?? false,
          created_at: editingBacklink?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        Boolean(editingBacklink),
      );
      beginCreate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">外链管理</h2>
            <p className="text-sm text-gray-500 mt-1">维护待提交页面，并把当前筛选结果写入“下一个外链”队列。</p>
          </div>
          <div className="flex gap-2">
            <button onClick={beginCreate} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              新建外链
            </button>
            <button
              onClick={() => onOpenFiltered(filteredBacklinks.map(backlink => backlink.id), selectedGroupId === 'all' ? undefined : selectedGroupId)}
              disabled={filteredBacklinks.length === 0}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              打开筛选结果
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">外链 URL</label>
              <input
                value={draft.url ?? ''}
                onChange={event => setDraft(current => ({ ...current, url: event.target.value }))}
                placeholder="https://example.com/post"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">站点名称</label>
              <input
                value={draft.title ?? ''}
                onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                placeholder="例如 WordStream Blog"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">备注</label>
              <input
                value={draft.note ?? ''}
                onChange={event => setDraft(current => ({ ...current, note: event.target.value }))}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">站点简介</label>
              <textarea
                value={draft.description ?? ''}
                onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">关键词（逗号分隔）</label>
              <input
                value={(draft.keywords ?? []).join(', ')}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    keywords: event.target.value.split(',').map(keyword => keyword.trim()).filter(Boolean),
                  }))
                }
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">站点类型</label>
                <select
                  value={draft.site_type ?? 'blog_comment'}
                  onChange={event => setDraft(current => ({ ...current, site_type: event.target.value as ManagedBacklinkSiteType }))}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                >
                  {Object.entries(siteTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">价格类型</label>
                <select
                  value={draft.pricing ?? 'free'}
                  onChange={event => setDraft(current => ({ ...current, pricing: event.target.value as ManagedBacklinkPricing }))}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                >
                  {Object.entries(pricingLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">DR</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.dr ?? ''}
                  onChange={event => setDraft(current => ({ ...current, dr: event.target.value ? Number(event.target.value) : undefined }))}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">AS</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.as ?? ''}
                  onChange={event => setDraft(current => ({ ...current, as: event.target.value ? Number(event.target.value) : undefined }))}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">语言</label>
                <input
                  value={draft.language ?? ''}
                  onChange={event => setDraft(current => ({ ...current, language: event.target.value }))}
                  placeholder="English / 中文"
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">分组</label>
              <div className="flex gap-2">
                <select
                  value={draft.group_id ?? 'default'}
                  onChange={event => setDraft(current => ({ ...current, group_id: event.target.value }))}
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                >
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.backlink_count})
                    </option>
                  ))}
                </select>
                <input
                  value={groupName}
                  onChange={event => setGroupName(event.target.value)}
                  placeholder="新分组"
                  className="w-32 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
                <button
                  onClick={async () => {
                    if (!groupName.trim()) return;
                    await onAddGroup(groupName.trim());
                    setGroupName('');
                  }}
                  className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  添加
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.flagged ?? false}
                onChange={event => setDraft(current => ({ ...current, flagged: event.target.checked }))}
              />
              标记此外链
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_available ?? true}
                onChange={event => setDraft(current => ({ ...current, is_available: event.target.checked }))}
              />
              当前可用
            </label>
          </div>

          <div className="space-y-4 bg-[#101010] text-white rounded-[28px] border border-white/10 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2 text-white/80">域名 / URL / 备注</label>
                <input value={search} onChange={event => setSearch(event.target.value)} className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-[#161616] text-white" placeholder="example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white/80">站点类型</label>
                <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as 'all' | ManagedBacklinkSiteType)} className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-[#161616] text-white">
                  <option value="all">全部类型</option>
                  {Object.entries(siteTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white/80">可用状态</label>
                <select value={availabilityFilter} onChange={event => setAvailabilityFilter(event.target.value as 'all' | 'available' | 'unavailable')} className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-[#161616] text-white">
                  <option value="all">全部状态</option>
                  <option value="available">可用</option>
                  <option value="unavailable">不可用</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white/80">分组</label>
                <select value={selectedGroupId} onChange={event => setSelectedGroupId(event.target.value)} className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-[#161616] text-white">
                  <option value="all">所有分组</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-white/70">
              <div>当前筛选结果 {filteredBacklinks.length} 条</div>
              <div>域名唯一 {uniqueByDomain ? '已开启' : '未开启'}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
            {saving ? '保存中...' : editingBacklink ? '更新外链' : '保存外链'}
          </button>
          <button onClick={beginCreate} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100">
            重置表单
          </button>
        </div>
      </div>

      <div className="bg-[#0c0c0c] text-white p-6 rounded-[32px] shadow-2xl border border-white/10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-semibold">外链列表</h3>
            <div className="text-sm text-white/60 mt-1">展示 URL、站点类型、可用状态，并保持接近你给的卡片样式。</div>
          </div>
          <div className="text-sm text-white/60">共 {filteredBacklinks.length} 条</div>
        </div>
        <div className="space-y-4">
          {filteredBacklinks.length === 0 && <div className="text-sm text-gray-500">当前没有符合条件的外链。</div>}
          {filteredBacklinks.map(backlink => (
            <div key={backlink.id} className="rounded-[26px] border border-white/10 bg-[#1a1a1a] p-5 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-2xl leading-none truncate">{backlink.title || backlink.domain}</div>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    {pricingLabels[backlink.pricing ?? 'free']}
                  </span>
                  {backlink.flagged && <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">已标记</span>}
                  <span className={`text-xs px-2 py-0.5 rounded ${(backlink.is_available ?? true) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {(backlink.is_available ?? true) ? '可用' : '不可用'}
                  </span>
                </div>
                <div className="text-base text-white/85 break-all">{backlink.url}</div>
                <div className="text-sm text-white/60">
                  类型: {siteTypeLabels[backlink.site_type ?? 'blog_comment']}
                  {backlink.language && ` · 语言: ${backlink.language}`}
                  {backlink.dr !== undefined && ` · DR ${backlink.dr}`}
                  {backlink.as !== undefined && ` · AS ${backlink.as}`}
                </div>
                <div className="text-sm text-white/70">
                  提示: {backlink.note || backlink.description || '暂无提示'}
                </div>
                {backlink.keywords.length > 0 && <div className="text-xs text-white/50">关键词: {backlink.keywords.join(', ')}</div>}
              </div>
              <div className="flex gap-2 flex-shrink-0 items-center">
                {onCollectBacklink && (
                  <button
                    onClick={async () => {
                      setCollectingId(backlink.id);
                      try {
                        await onCollectBacklink(backlink.url);
                      } finally {
                        setCollectingId(null);
                      }
                    }}
                    disabled={collectingId === backlink.id}
                    className="px-3 py-1.5 bg-purple-500 text-white rounded-full hover:bg-purple-600 text-sm disabled:opacity-50"
                  >
                    {collectingId === backlink.id ? '采集中...' : '自动采集'}
                  </button>
                )}
                <button onClick={() => onOpenBacklink(backlink.id, filteredBacklinks.map(item => item.id), backlink.group_id)} className="px-5 py-2 bg-white text-black rounded-full hover:bg-white/90 text-sm font-medium">
                  开始
                </button>
                <button onClick={() => beginEdit(backlink)} className="px-3 py-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 text-sm">
                  编辑
                </button>
                <button onClick={() => onDeleteBacklink(backlink.id)} className="px-3 py-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 text-sm">
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
