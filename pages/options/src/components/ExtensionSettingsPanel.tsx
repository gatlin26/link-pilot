import React, { useEffect, useState } from 'react';
import { extensionSettingsStorage } from '@extension/storage';
import type { ExtensionSettings } from '@extension/shared';

export const ExtensionSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>({
    auto_detect_form: false,
    auto_start_fill: false,
    next_backlink_count: 1,
    unique_backlink_domain: true,
    show_manual_fill_hints: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void extensionSettingsStorage.get().then(setSettings);
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await extensionSettingsStorage.updateSettings(settings);
      alert('设置已保存');
    } catch (error) {
      alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">基本设置</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">自动检测表单</div>
              <div className="text-sm text-gray-500">页面加载时自动检测表单</div>
            </div>
            <input
              type="checkbox"
              checked={settings.auto_detect_form}
              onChange={e => setSettings({ ...settings, auto_detect_form: e.target.checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">自动开始填充</div>
              <div className="text-sm text-gray-500">检测到表单后，若当前已有已选网站资料，则自动开始填充</div>
            </div>
            <input
              type="checkbox"
              checked={settings.auto_start_fill}
              onChange={e => setSettings({ ...settings, auto_start_fill: e.target.checked })}
            />
          </div>

          <div>
            <label className="block font-medium mb-2">下一个外链打开数量</label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.next_backlink_count}
              onChange={e =>
                setSettings({
                  ...settings,
                  next_backlink_count: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                })
              }
              className="w-32 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
      </div>

      <div className="border-t dark:border-gray-700 pt-6">
        <h2 className="text-xl font-bold mb-4">外链设置</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">外链域名唯一</div>
              <div className="text-sm text-gray-500">每个域名只显示一个外链</div>
            </div>
            <input
              type="checkbox"
              checked={settings.unique_backlink_domain}
              onChange={e => setSettings({ ...settings, unique_backlink_domain: e.target.checked })}
            />
          </div>
        </div>
      </div>

      <div className="border-t dark:border-gray-700 pt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
};
