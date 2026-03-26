/**
 * 动态字段操作服务
 */

import type { DynamicFieldDefinition, DynamicFieldValue } from '@extension/shared';

const mergeFields = (function () {
  // eslint-disable-next-line func-style
  function impl(
    aiFields: DynamicFieldDefinition[],
    userValues: DynamicFieldValue[],
    hiddenKeys: string[],
  ): DynamicFieldDefinition[] {
    const userValueMap = new Map(userValues.map(v => [v.key, v]));

    return aiFields
      .filter(f => !hiddenKeys.includes(f.key))
      .map(field => {
        const userVal = userValueMap.get(field.key);
        if (userVal) {
          return {
            ...field,
            defaultValue: userVal.value,
            source: 'user' as const,
            visible: true,
          };
        }
        return field;
      });
  }

  return impl;
})();

const createFieldDefinition = (function () {
  // eslint-disable-next-line func-style
  function impl(
    key: string,
    label: string,
    type: DynamicFieldDefinition['type'] = 'text',
    group: DynamicFieldDefinition['group'] = 'custom',
  ): DynamicFieldDefinition {
    return {
      key,
      label,
      type,
      source: 'user',
      required: false,
      visible: true,
      group,
      order: 0,
    };
  }

  return impl;
})();

const fieldsToRecord = (function () {
  // eslint-disable-next-line func-style
  function impl(values: DynamicFieldValue[]): Record<string, string> {
    return Object.fromEntries(values.map(v => [v.key, v.value]));
  }

  return impl;
})();

const recordToFields = (function () {
  // eslint-disable-next-line func-style
  function impl(record: Record<string, string>, updatedBy: 'ai' | 'user'): DynamicFieldValue[] {
    return Object.entries(record).map(([key, value]) => ({
      key,
      value,
      updatedBy,
      updatedAt: new Date().toISOString(),
    }));
  }

  return impl;
})();

export { mergeFields, createFieldDefinition, fieldsToRecord, recordToFields };
