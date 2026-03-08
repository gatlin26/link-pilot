import { useMemo, useState } from 'react';
import type { WebsiteProfile, WebsiteProfileGroup } from '@extension/shared';

interface WebsiteProfilesPanelProps {
  profiles: WebsiteProfile[];
  groups: WebsiteProfileGroup[];
  onSaveProfile: (profile: WebsiteProfile, isEditing: boolean) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onAddGroup: (name: string) => Promise<void>;
}

const createEmptyProfile = (): Partial<WebsiteProfile> => ({
  name: '',
  url: '',
  email: '',
  comments: [''],
  group_id: 'default',
  enabled: true,
});

export function WebsiteProfilesPanel({
  profiles,
  groups,
  onSaveProfile,
  onDeleteProfile,
  onAddGroup,
}: WebsiteProfilesPanelProps) {
  const [editingProfile, setEditingProfile] = useState<WebsiteProfile | null>(null);
  const [draft, setDraft] = useState<Partial<WebsiteProfile>>(createEmptyProfile());
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.name.localeCompare(right.name)),
    [profiles],
  );

  const beginCreate = () => {
    setEditingProfile(null);
    setDraft(createEmptyProfile());
  };

  const beginEdit = (profile: WebsiteProfile) => {
    setEditingProfile(profile);
    setDraft({ ...profile, comments: [...profile.comments] });
  };

  const save = async () => {
    if (!draft.name?.trim() || !draft.url?.trim() || !draft.email?.trim()) {
      alert('请填写名称、URL 和邮箱');
      return;
    }

    const comments = (draft.comments ?? []).map(comment => comment.trim()).filter(Boolean);
    if ((draft.enabled ?? true) && comments.length === 0) {
      alert('启用中的网站必须至少有一条评论内容');
      return;
    }

    let domain = '';
    try {
      domain = new URL(draft.url).hostname;
    } catch {
      alert('请输入合法的 URL');
      return;
    }

    setSaving(true);
    try {
      await onSaveProfile(
        {
          id: editingProfile?.id ?? `website-profile-${Date.now()}`,
          group_id: draft.group_id || 'default',
          name: draft.name.trim(),
          url: draft.url.trim(),
          domain,
          email: draft.email.trim(),
          comments,
          enabled: draft.enabled ?? true,
          created_at: editingProfile?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        Boolean(editingProfile),
      );
      beginCreate();
    } finally {
      setSaving(false);
    }
  };

  const addComment = () => {
    setDraft(current => ({ ...current, comments: [...(current.comments ?? []), ''] }));
  };

  const updateComment = (index: number, value: string) => {
    setDraft(current => ({
      ...current,
      comments: (current.comments ?? []).map((comment, commentIndex) => (commentIndex === index ? value : comment)),
    }));
  };

  const removeComment = (index: number) => {
    setDraft(current => ({
      ...current,
      comments: (current.comments ?? []).filter((_, commentIndex) => commentIndex !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">我的网站</h2>
            <p className="text-sm text-gray-500 mt-1">维护填表时使用的网站资料与预设评论。</p>
          </div>
          <button onClick={beginCreate} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            新建网站
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">网站名称</label>
              <input
                value={draft.name ?? ''}
                onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">网站 URL</label>
              <input
                value={draft.url ?? ''}
                onChange={event => setDraft(current => ({ ...current, url: event.target.value }))}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">邮箱</label>
              <input
                value={draft.email ?? ''}
                onChange={event => setDraft(current => ({ ...current, email: event.target.value }))}
                placeholder="hello@example.com"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
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
                      {group.name} ({group.website_count})
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
                checked={draft.enabled ?? true}
                onChange={event => setDraft(current => ({ ...current, enabled: event.target.checked }))}
              />
              启用此网站资料
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">评论内容列表</label>
              <button onClick={addComment} className="text-sm text-blue-600 hover:underline">
                新增评论
              </button>
            </div>
            {(draft.comments ?? []).map((comment, index) => (
              <div key={index} className="flex gap-2 items-start">
                <textarea
                  value={comment}
                  onChange={event => updateComment(index, event.target.value)}
                  rows={3}
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  placeholder={`评论 ${index + 1}`}
                />
                <button onClick={() => removeComment(index)} className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
            {saving ? '保存中...' : editingProfile ? '更新网站' : '保存网站'}
          </button>
          <button onClick={beginCreate} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100">
            重置表单
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">已保存网站</h3>
        <div className="space-y-3">
          {sortedProfiles.length === 0 && <div className="text-sm text-gray-500">还没有网站资料，先创建一个吧。</div>}
          {sortedProfiles.map(profile => (
            <div key={profile.id} className="border dark:border-gray-700 rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{profile.name}</div>
                  <span className={`text-xs px-2 py-0.5 rounded ${profile.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {profile.enabled ? '启用' : '停用'}
                  </span>
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400 truncate">{profile.url}</div>
                <div className="text-sm text-gray-500">{profile.email}</div>
                <div className="text-xs text-gray-500">
                  分组: {groups.find(group => group.id === profile.group_id)?.name ?? '默认分组'} · 评论 {profile.comments.length} 条
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => beginEdit(profile)} className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                  编辑
                </button>
                <button onClick={() => onDeleteProfile(profile.id)} className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
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
