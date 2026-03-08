import React, { useState, useEffect } from 'react';
import type { WebsiteConfig, WebsiteGroup } from '@extension/shared';

interface WebsiteConfigFormProps {
  config?: WebsiteConfig;
  groups: WebsiteGroup[];
  onSave: (config: WebsiteConfig) => Promise<void>;
  onCancel: () => void;
}

export const WebsiteConfigForm: React.FC<WebsiteConfigFormProps> = ({
  config,
  groups,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Partial<WebsiteConfig>>({
    name: '',
    url: '',
    domain: '',
    group_id: 'default',
    categories: [],
    description: '',
    keywords: [],
    enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url) {
      alert('请填写网站名称和 URL');
      return;
    }

    try {
      setSaving(true);
      const domain = new URL(formData.url).hostname;
      const configData: WebsiteConfig = {
        id: config?.id || `website-${Date.now()}`,
        name: formData.name,
        url: formData.url,
        domain,
        group_id: formData.group_id || 'default',
        categories: formData.categories || [],
        description: formData.description,
        keywords: formData.keywords,
        enabled: formData.enabled ?? true,
        created_at: config?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await onSave(configData);
    } catch (error) {
      alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    if (categoryInput.trim() && !formData.categories?.includes(categoryInput.trim())) {
      setFormData({
        ...formData,
        categories: [...(formData.categories || []), categoryInput.trim()],
      });
      setCategoryInput('');
    }
  };

  const removeCategory = (cat: string) => {
    setFormData({
      ...formData,
      categories: formData.categories?.filter(c => c !== cat) || [],
    });
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.keywords?.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        keywords: [...(formData.keywords || []), keywordInput.trim()],
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords?.filter(k => k !== keyword) || [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">网站名称 *</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">网站 URL *</label>
        <input
          type="url"
          value={formData.url}
          onChange={e => setFormData({ ...formData, url: e.target.value })}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          placeholder="https://example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">分组</label>
        <select
          value={formData.group_id}
          onChange={e => setFormData({ ...formData, group_id: e.target.value })}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
        >
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">网站描述</label>
        <textarea
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">分类标签</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={categoryInput}
            onChange={e => setCategoryInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
            className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="输入分类后按回车"
          />
          <button
            type="button"
            onClick={addCategory}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            添加
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.categories?.map(cat => (
            <span
              key={cat}
              className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm flex items-center gap-1"
            >
              {cat}
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                className="text-blue-600 dark:text-blue-300 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">关键词</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="输入关键词后按回车"
          />
          <button
            type="button"
            onClick={addKeyword}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            添加
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.keywords?.map(keyword => (
            <span
              key={keyword}
              className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-sm flex items-center gap-1"
            >
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                className="text-green-600 dark:text-green-300 hover:text-green-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          checked={formData.enabled}
          onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="enabled" className="text-sm font-medium">
          启用此网站配置
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          取消
        </button>
      </div>
    </form>
  );
};
