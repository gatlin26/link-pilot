import { useEffect, useState } from 'react';
import { extensionSettingsStorage } from '@extension/storage';
import type { ExtensionSettings } from '@extension/shared';

export function MvpSettingsPanel() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void extensionSettingsStorage.get().then(setSettings);
  }, []);

  if (!settings) {
    return <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-sm text-gray-500">加载设置中...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">设置</h2>
        <p className="text-sm text-gray-500">只保留 MVP 需要的表单检测与外链队列设置。</p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">自动检测表单</div>
            <div className="text-sm text-gray-500">打开页面后自动检测是否存在可填表表单。</div>
          </div>
          <input type="checkbox" checked={settings.auto_detect_form} onChange={event => setSettings(current => current ? { ...current, auto_detect_form: event.target.checked } : current)} />
        </label>

        <label className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">自动开始填充</div>
            <div className="text-sm text-gray-500">检测到表单后，如当前已选择网站资料，则自动填入名称、邮箱、网站和评论。</div>
          </div>
          <input type="checkbox" checked={settings.auto_start_fill} onChange={event => setSettings(current => current ? { ...current, auto_start_fill: event.target.checked } : current)} />
        </label>

        <div>
          <label className="block font-medium mb-2">下一个外链打开数量</label>
          <input
            type="number"
            min="1"
            max="20"
            value={settings.next_backlink_count}
            onChange={event => setSettings(current => current ? { ...current, next_backlink_count: Math.max(1, Math.min(20, Number(event.target.value) || 1)) } : current)}
            className="w-32 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          />
        </div>

        <label className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">同分组域名唯一</div>
            <div className="text-sm text-gray-500">开启后，外链列表过滤时同一域名只显示一条。</div>
          </div>
          <input type="checkbox" checked={settings.unique_backlink_domain} onChange={event => setSettings(current => current ? { ...current, unique_backlink_domain: event.target.checked } : current)} />
        </label>
      </div>

      <button
        onClick={async () => {
          setSaving(true);
          try {
            await extensionSettingsStorage.updateSettings(settings);
            alert('设置已保存');
          } finally {
            setSaving(false);
          }
        }}
        disabled={saving}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存设置'}
      </button>
    </div>
  );
}
