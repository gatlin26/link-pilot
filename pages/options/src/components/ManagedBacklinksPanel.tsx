import { useMemo, useState } from 'react';
import type { ManagedBacklink, ManagedBacklinkGroup } from '@extension/shared';

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
  note: '',
  keywords: [],
  dr: undefined,
  as: undefined,
  flagged: false,
  group_id: 'default',
});

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
  const [noteFilter, setNoteFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [saving, setSaving] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const filteredBacklinks = useMemo(() => {
    let result = backlinks.filter(backlink => {
      const matchesGroup = selectedGroupId === 'all' || backlink.group_id === selectedGroupId;
      const matchesSearch = !search || backlink.url.toLowerCase().includes(search.toLowerCase());
      const matchesNote = !noteFilter || (backlink.note ?? '').toLowerCase().includes(noteFilter.toLowerCase());
      const matchesKeyword =
        !keywordFilter || backlink.keywords.some(keyword => keyword.toLowerCase().includes(keywordFilter.toLowerCase()));
      return matchesGroup && matchesSearch && matchesNote && matchesKeyword;
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
  }, [backlinks, keywordFilter, noteFilter, search, selectedGroupId, uniqueByDomain]);

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
              <label className="block text-sm font-medium mb-2">备注</label>
              <input
                value={draft.note ?? ''}
                onChange={event => setDraft(current => ({ ...current, note: event.target.value }))}
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
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">按 URL 过滤</label>
                <input value={search} onChange={event => setSearch(event.target.value)} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">按备注过滤</label>
                <input value={noteFilter} onChange={event => setNoteFilter(event.target.value)} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">按关键词过滤</label>
                <input value={keywordFilter} onChange={event => setKeywordFilter(event.target.value)} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">分组</label>
                <select value={selectedGroupId} onChange={event => setSelectedGroupId(event.target.value)} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                  <option value="all">所有分组</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-sm text-gray-500">当前筛选结果 {filteredBacklinks.length} 条；点击“打开筛选结果”后可在弹窗中使用“下一个外链”。</div>
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

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">筛选结果</h3>
        <div className="space-y-3">
          {filteredBacklinks.length === 0 && <div className="text-sm text-gray-500">当前没有符合条件的外链。</div>}
          {filteredBacklinks.map(backlink => (
            <div key={backlink.id} className="border dark:border-gray-700 rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{backlink.domain}</div>
                  {backlink.flagged && <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">已标记</span>}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400 truncate">{backlink.url}</div>
                <div className="text-xs text-gray-500">
                  分组: {groups.find(group => group.id === backlink.group_id)?.name ?? '默认分组'}
                  {backlink.dr !== undefined && ` · DR ${backlink.dr}`}
                  {backlink.as !== undefined && ` · AS ${backlink.as}`}
                </div>
                {backlink.note && <div className="text-sm text-gray-500">{backlink.note}</div>}
                {backlink.keywords.length > 0 && <div className="text-xs text-gray-500">关键词: {backlink.keywords.join(', ')}</div>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
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
                    className="px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm disabled:opacity-50"
                  >
                    {collectingId === backlink.id ? '采集中...' : '自动采集'}
                  </button>
                )}
                <button onClick={() => onOpenBacklink(backlink.id, filteredBacklinks.map(item => item.id), backlink.group_id)} className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm">
                  打开外链
                </button>
                <button onClick={() => beginEdit(backlink)} className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                  编辑
                </button>
                <button onClick={() => onDeleteBacklink(backlink.id)} className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
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
