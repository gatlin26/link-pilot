/**
 * 可视化动态字段编辑器
 * AI 生成字段 + 用户可编辑、可显示/隐藏、可删除、可新增
 */

import type { DynamicFieldDefinition, DynamicFieldValue } from '@extension/shared';

interface DynamicFieldEditorProps {
  fields: DynamicFieldDefinition[];
  values: DynamicFieldValue[];
  onValuesChange: (values: DynamicFieldValue[]) => void;
  onFieldToggle: (key: string, visible: boolean) => void;
  onFieldUpdate: (key: string, value: string) => void;
  onAddField: () => void;
  onRemoveField: (key: string) => void;
  disabled?: boolean;
}

const DynamicFieldEditor = (props: DynamicFieldEditorProps) => {
  const { fields, values, onValuesChange, onFieldToggle, onAddField, onRemoveField, disabled } = props;

  const valueMap = new Map(values.map(v => [v.key, v]));

  const getValue = (key: string): string => valueMap.get(key)?.value ?? '';

  const handleValueChange = (key: string, val: string) => {
    const existing = values.find(v => v.key === key);
    if (existing) {
      onValuesChange(values.map(v => (v.key === key ? { ...v, value: val, updatedAt: new Date().toISOString() } : v)));
    } else {
      onValuesChange([...values, { key, value: val, updatedBy: 'user', updatedAt: new Date().toISOString() }]);
    }
  };

  const sourceBadge = (source: DynamicFieldDefinition['source']) => {
    const colors = {
      ai: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      user: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      system: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    };
    const labels = { ai: 'AI', user: '用户', system: '系统' };
    return <span className={`rounded px-1.5 py-0.5 text-xs ${colors[source]}`}>{labels[source]}</span>;
  };

  const visibleFields = fields.filter(f => f.visible);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">动态字段</h4>
        <button
          onClick={onAddField}
          disabled={disabled}
          className="rounded bg-blue-500 px-2 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50">
          + 新增字段
        </button>
      </div>

      {visibleFields.length === 0 && (
        <div className="py-4 text-center text-sm text-gray-500">
          暂无字段，请输入 URL 并点击&quot;AI 抓取&quot;生成字段
        </div>
      )}

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {visibleFields
          .sort((a, b) => a.order - b.order)
          .map(field => (
            <div key={field.key} className="rounded-lg border bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium">{field.label}</span>
                <span className="text-xs text-gray-400">({field.key})</span>
                {sourceBadge(field.source)}
                {field.required && <span className="text-xs text-red-500">*必填</span>}
                <div className="flex-1" />
                <button
                  onClick={() => onFieldToggle(field.key, false)}
                  disabled={disabled}
                  className="text-xs text-gray-400 hover:text-red-500">
                  隐藏
                </button>
                <button
                  onClick={() => onRemoveField(field.key)}
                  disabled={disabled}
                  className="text-xs text-red-400 hover:text-red-600">
                  删除
                </button>
              </div>

              {field.type === 'textarea' ? (
                <textarea
                  value={getValue(field.key)}
                  onChange={e => handleValueChange(field.key, e.target.value)}
                  disabled={disabled}
                  placeholder={field.placeholder || `输入 ${field.label}`}
                  rows={3}
                  className="w-full rounded border px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
              ) : field.type === 'tag-list' ? (
                <input
                  value={getValue(field.key)}
                  onChange={e => handleValueChange(field.key, e.target.value)}
                  disabled={disabled}
                  placeholder="逗号分隔多个标签"
                  className="w-full rounded border px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
              ) : (
                <input
                  type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'}
                  value={getValue(field.key)}
                  onChange={e => handleValueChange(field.key, e.target.value)}
                  disabled={disabled}
                  placeholder={field.placeholder || `输入 ${field.label}`}
                  className="w-full rounded border px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
              )}

              {field.description && <p className="mt-1 text-xs text-gray-400">{field.description}</p>}
            </div>
          ))}
      </div>
    </div>
  );
};

export { DynamicFieldEditor };
