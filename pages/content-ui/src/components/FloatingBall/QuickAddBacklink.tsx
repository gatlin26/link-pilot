/**
 * 快速添加外链组件
 * 在当前页面外链不在库中时，快速添加新外链
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ManagedBacklink, ManagedBacklinkGroup } from '@extension/shared';
import { managedBacklinkStorage } from '@extension/storage';
import {
  extractPageInfo,
  extractDomain,
  isValidUrl,
  generateId,
  parseKeywords,
  type ExtractedPageInfo,
} from './utils';

/**
 * 组件 Props
 */
export interface QuickAddBacklinkProps {
  /** 当前页面 URL */
  currentUrl: string;
  /** 当前页面标题 */
  currentTitle: string;
  /** 添加成功回调 */
  onAdded: (backlink: ManagedBacklink) => void;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * 表单状态
 */
interface FormState {
  url: string;
  domain: string;
  note: string;
  keywords: string;
  groupId: string;
  newGroupName: string;
  isCreatingNewGroup: boolean;
}

/**
 * 表单错误
 */
interface FormErrors {
  url?: string;
  group?: string;
  newGroupName?: string;
}

/**
 * 快速添加外链组件
 */
export function QuickAddBacklink({
  currentUrl,
  currentTitle,
  onAdded,
  onCancel,
}: QuickAddBacklinkProps) {
  // 分组列表
  const [groups, setGroups] = useState<ManagedBacklinkGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  // 表单状态
  const [form, setForm] = useState<FormState>({
    url: currentUrl,
    domain: extractDomain(currentUrl),
    note: '',
    keywords: '',
    groupId: '',
    newGroupName: '',
    isCreatingNewGroup: false,
  });

  // 表单错误
  const [errors, setErrors] = useState<FormErrors>({});

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 加载分组列表
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setIsLoadingGroups(true);
      const allGroups = await managedBacklinkStorage.getAllGroups();
      setGroups(allGroups);

      // 默认选择第一个分组
      if (allGroups.length > 0 && !form.groupId) {
        setForm(prev => ({ ...prev, groupId: allGroups[0].id }));
      }
    } catch (error) {
      console.error('加载分组失败:', error);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // 验证表单
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // URL 验证
    if (!form.url.trim()) {
      newErrors.url = '请输入 URL';
    } else if (!isValidUrl(form.url)) {
      newErrors.url = 'URL 格式无效';
    }

    // 分组验证
    if (form.isCreatingNewGroup) {
      if (!form.newGroupName.trim()) {
        newErrors.newGroupName = '请输入分组名称';
      }
    } else if (!form.groupId) {
      newErrors.group = '请选择分组';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  // 检查 URL 是否已存在
  const checkUrlExists = async (url: string, groupId: string): Promise<boolean> => {
    return await managedBacklinkStorage.hasUrlInGroup(url, groupId);
  };

  // 创建新分组
  const createNewGroup = async (name: string): Promise<string> => {
    const newGroup: ManagedBacklinkGroup = {
      id: generateId(),
      name,
      backlink_count: 0,
      created_at: new Date().toISOString(),
    };
    await managedBacklinkStorage.addGroup(newGroup);
    return newGroup.id;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 确定目标分组 ID
      let targetGroupId = form.groupId;
      if (form.isCreatingNewGroup) {
        targetGroupId = await createNewGroup(form.newGroupName.trim());
      }

      // 检查 URL 是否已存在
      const exists = await checkUrlExists(form.url, targetGroupId);
      if (exists) {
        setSubmitError('该 URL 已存在于所选分组中');
        setIsSubmitting(false);
        return;
      }

      // 创建新外链
      const newBacklink: ManagedBacklink = {
        id: generateId(),
        group_id: targetGroupId,
        url: form.url.trim(),
        domain: form.domain.trim() || extractDomain(form.url),
        note: form.note.trim() || undefined,
        keywords: parseKeywords(form.keywords),
        flagged: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 保存到 storage
      await managedBacklinkStorage.addBacklink(newBacklink);

      // 触发成功回调
      onAdded(newBacklink);
    } catch (error) {
      console.error('添加外链失败:', error);
      setSubmitError('添加失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 更新 URL 时自动更新域名
  const handleUrlChange = (url: string) => {
    setForm(prev => ({
      ...prev,
      url,
      domain: extractDomain(url),
    }));
    // 清除错误
    if (errors.url) {
      setErrors(prev => ({ ...prev, url: undefined }));
    }
  };

  // 切换创建新分组
  const toggleCreateNewGroup = () => {
    setForm(prev => ({
      ...prev,
      isCreatingNewGroup: !prev.isCreatingNewGroup,
      newGroupName: '',
    }));
    setErrors(prev => ({ ...prev, group: undefined, newGroupName: undefined }));
  };

  // 表单字段更新
  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // 清除对应错误
    const errorField = field === 'url' ? 'url' : field === 'groupId' ? 'group' : undefined;
    if (errorField && errors[errorField]) {
      setErrors(prev => ({ ...prev, [errorField]: undefined }));
    }
  };

  // 选择的分组名称
  const selectedGroupName = useMemo(() => {
    const group = groups.find(g => g.id === form.groupId);
    return group?.name || '选择分组';
  }, [groups, form.groupId]);

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">添加外链</h3>
        <button
          onClick={onCancel}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* URL 字段 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">
          URL <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.url}
          onChange={e => handleUrlChange(e.target.value)}
          placeholder="https://example.com/page"
          className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
            errors.url
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
          }`}
        />
        {errors.url && <p className="text-xs text-red-500">{errors.url}</p>}
      </div>

      {/* 命名字段 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">域名</label>
        <input
          type="text"
          value={form.domain}
          onChange={e => updateField('domain', e.target.value)}
          placeholder="example.com"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* 备注字段 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">备注</label>
        <input
          type="text"
          value={form.note}
          onChange={e => updateField('note', e.target.value)}
          placeholder="例如：博客评论页、联系表单页"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* 关键词字段 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">关键词</label>
        <input
          type="text"
          value={form.keywords}
          onChange={e => updateField('keywords', e.target.value)}
          placeholder="SEO, 外链建设, 工具（逗号分隔）"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <p className="text-xs text-gray-400">用于智能匹配，逗号分隔</p>
      </div>

      {/* 分组选择 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">
          分组 <span className="text-red-500">*</span>
        </label>

        {form.isCreatingNewGroup ? (
          <div className="space-y-2">
            <input
              type="text"
              value={form.newGroupName}
              onChange={e => updateField('newGroupName', e.target.value)}
              placeholder="输入新分组名称"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
                errors.newGroupName
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
            />
            {errors.newGroupName && <p className="text-xs text-red-500">{errors.newGroupName}</p>}
            <button
              onClick={toggleCreateNewGroup}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              选择已有分组
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <select
                value={form.groupId}
                onChange={e => updateField('groupId', e.target.value)}
                disabled={isLoadingGroups}
                className={`w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm text-gray-900 focus:outline-none focus:ring-2 ${
                  errors.group
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                } ${isLoadingGroups ? 'bg-gray-50' : 'bg-white'}`}
              >
                <option value="">选择分组</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.backlink_count} 个外链)
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {errors.group && <p className="text-xs text-red-500">{errors.group}</p>}
            <button
              onClick={toggleCreateNewGroup}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              + 新建分组
            </button>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {submitError && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{submitError}</div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              保存中...
            </span>
          ) : (
            '添加并填充'
          )}
        </button>
      </div>
    </div>
  );
}

export default QuickAddBacklink;
