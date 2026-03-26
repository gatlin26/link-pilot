import { useMemo, useState } from 'react';
import {
  buildWebsiteProfileDynamicFields,
  extractWebsiteProfileFromHtml,
  type ManagedBacklinkSiteType,
  type WebsiteProfile,
  type WebsiteProfileDynamicField,
  type WebsiteProfileGroup,
} from '@extension/shared';

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
  title: '',
  tagline: '',
  description: '',
  logo_url: '',
  screenshot_url: '',
  categories: [],
  keywords: [],
  comments: [''],
  group_id: 'default',
  enabled: true,
});

const scenarioOptions: Array<{ value: ManagedBacklinkSiteType; label: string }> = [
  { value: 'blog_comment', label: 'Blog 评论' },
  { value: 'ai_directory', label: 'AI 导航站' },
  { value: 'tool_directory', label: '工具导航站' },
  { value: 'submission_form', label: '提交表单' },
  { value: 'partner', label: '合作/友链' },
  { value: 'other', label: '其他' },
];

function renderFieldValue(field: WebsiteProfileDynamicField) {
  if (Array.isArray(field.value)) {
    return field.value.join(' / ');
  }
  return field.value;
}

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
  const [scraping, setScraping] = useState(false);
  const [previewSiteType, setPreviewSiteType] = useState<ManagedBacklinkSiteType>('blog_comment');

  const sortedProfiles = useMemo(
    () => [...profiles].sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.name.localeCompare(right.name)),
    [profiles],
  );
  const previewFields = useMemo(
    () =>
      buildWebsiteProfileDynamicFields(
        {
          ...draft,
          comments: draft.comments ?? [],
          comment_templates: draft.comments ?? [],
        },
        { siteType: previewSiteType },
      ),
    [draft, previewSiteType],
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
    if (!draft.name?.trim() || !draft.url?.trim()) {
      alert('请填写名称和 URL');
      return;
    }

    const comments = (draft.comments ?? []).map(comment => comment.trim()).filter(Boolean);

    let domain = '';
    try {
      domain = new URL(draft.url).hostname;
    } catch {
      alert('请输入合法的 URL');
      return;
    }

    setSaving(true);
    try {
      const nextProfile: WebsiteProfile = {
        id: editingProfile?.id ?? `website-profile-${Date.now()}`,
        group_id: draft.group_id || 'default',
        name: draft.name.trim(),
        url: draft.url.trim(),
        domain,
        email: draft.email?.trim() ?? '',
        title: draft.title?.trim() || undefined,
        tagline: draft.tagline?.trim() || undefined,
        description: draft.description?.trim() || undefined,
        logo_url: draft.logo_url?.trim() || undefined,
        screenshot_url: draft.screenshot_url?.trim() || undefined,
        categories: (draft.categories ?? []).map(item => item.trim()).filter(Boolean),
        keywords: (draft.keywords ?? []).map(item => item.trim()).filter(Boolean),
        comments,
        comment_templates: comments,
        dynamic_fields: buildWebsiteProfileDynamicFields(
          {
            ...draft,
            id: editingProfile?.id ?? `website-profile-${Date.now()}`,
            group_id: draft.group_id || 'default',
            name: draft.name.trim(),
            url: draft.url.trim(),
            domain,
            email: draft.email?.trim() ?? '',
            comments,
            comment_templates: comments,
            categories: (draft.categories ?? []).map(item => item.trim()).filter(Boolean),
            keywords: (draft.keywords ?? []).map(item => item.trim()).filter(Boolean),
          },
          { siteType: 'other' },
        ),
        scraped_at: draft.scraped_at,
        enabled: draft.enabled ?? true,
        created_at: editingProfile?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await onSaveProfile(
        nextProfile,
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

  const scrapeWebsite = async () => {
    if (!draft.url?.trim()) {
      alert('请先输入网站 URL');
      return;
    }

    let url = '';
    try {
      url = new URL(draft.url.trim()).toString();
    } catch {
      alert('请输入合法的 URL');
      return;
    }

    setScraping(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`抓取失败: ${response.status}`);
      }
      const html = await response.text();
      const scraped = extractWebsiteProfileFromHtml(html, url);
      setDraft(current => ({
        ...current,
        url,
        name: current.name?.trim() || scraped.name || '',
        title: scraped.title || current.title || '',
        tagline: scraped.tagline || current.tagline || '',
        description: scraped.description || current.description || '',
        logo_url: scraped.logo_url || current.logo_url || '',
        screenshot_url: scraped.screenshot_url || current.screenshot_url || '',
        categories: scraped.categories?.length ? scraped.categories : current.categories ?? [],
        keywords: scraped.keywords?.length ? scraped.keywords : current.keywords ?? [],
        scraped_at: scraped.scraped_at,
        dynamic_fields: buildWebsiteProfileDynamicFields(
          {
            ...current,
            ...scraped,
            url,
            comments: current.comments ?? [],
            comment_templates: current.comments ?? [],
          },
          { siteType: previewSiteType },
        ),
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : '抓取网站失败');
    } finally {
      setScraping(false);
    }
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
              <div className="flex gap-2">
                <input
                  value={draft.url ?? ''}
                  onChange={event => setDraft(current => ({ ...current, url: event.target.value }))}
                  placeholder="https://example.com"
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
                <button
                  onClick={scrapeWebsite}
                  disabled={scraping}
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
                >
                  {scraping ? '抓取中...' : '抓取信息'}
                </button>
              </div>
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
              <label className="block text-sm font-medium mb-2">网站标题</label>
              <input
                value={draft.title ?? ''}
                onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">网站简述</label>
              <input
                value={draft.tagline ?? ''}
                onChange={event => setDraft(current => ({ ...current, tagline: event.target.value }))}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">网站描述</label>
              <textarea
                value={draft.description ?? ''}
                onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Logo 图片</label>
              <input
                value={draft.logo_url ?? ''}
                onChange={event => setDraft(current => ({ ...current, logo_url: event.target.value }))}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">网站截图</label>
              <input
                value={draft.screenshot_url ?? ''}
                onChange={event => setDraft(current => ({ ...current, screenshot_url: event.target.value }))}
                placeholder="https://example.com/preview.png"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">分类（逗号分隔）</label>
              <input
                value={(draft.categories ?? []).join(', ')}
                onChange={event => setDraft(current => ({ ...current, categories: event.target.value.split(',').map(item => item.trim()).filter(Boolean) }))}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">关键词（逗号分隔）</label>
              <input
                value={(draft.keywords ?? []).join(', ')}
                onChange={event => setDraft(current => ({ ...current, keywords: event.target.value.split(',').map(item => item.trim()).filter(Boolean) }))}
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
              <label className="block text-sm font-medium">评论模板 / 备用评论</label>
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

            {(draft.logo_url || draft.screenshot_url) && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {draft.logo_url && (
                  <div className="border dark:border-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-2">Logo 预览</div>
                    <img src={draft.logo_url} alt="网站 Logo" className="w-full h-24 object-contain rounded bg-gray-50 dark:bg-gray-900" />
                  </div>
                )}
                {draft.screenshot_url && (
                  <div className="border dark:border-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-2">截图预览</div>
                    <img src={draft.screenshot_url} alt="网站截图" className="w-full h-24 object-cover rounded bg-gray-50 dark:bg-gray-900" />
                  </div>
                )}
              </div>
            )}

            <div className="border dark:border-gray-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">动态字段预览</div>
                  <div className="text-xs text-gray-500 mt-1">根据网站内容和使用场景自动整理字段，避免最终只剩一个 comment 字段。</div>
                </div>
                <select
                  value={previewSiteType}
                  onChange={event => setPreviewSiteType(event.target.value as ManagedBacklinkSiteType)}
                  className="px-3 py-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                >
                  {scenarioOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {previewFields.length === 0 && <div className="text-sm text-gray-500">补充网站信息后，这里会自动生成可展示字段。</div>}
                {previewFields.map(field => (
                  <div key={field.id} className="rounded-lg border dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-sm font-medium">{field.label}</div>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {field.source}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">{field.category}</div>
                    <div className="text-sm break-words leading-6">
                      {renderFieldValue(field)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                <div className="text-sm text-gray-500">{profile.tagline || profile.email || '暂无简述'}</div>
                <div className="text-xs text-gray-500">
                  分组: {groups.find(group => group.id === profile.group_id)?.name ?? '默认分组'} · 评论 {profile.comments.length} 条 · 字段 {(profile.dynamic_fields ?? []).length} 个
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
