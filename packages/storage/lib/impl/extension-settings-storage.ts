/**
 * 扩展设置存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { ExtensionSettings } from '@extension/shared';

const defaultSettings: ExtensionSettings = {
  auto_detect_form: false,
  auto_start_fill: false,
  next_backlink_count: 1,
  unique_backlink_domain: true,
  show_manual_fill_hints: false,
  auto_fill_confidence_threshold: 0.9,
  prompt_confidence_threshold: 0.6,
  enable_assisted_learning: true,
  show_field_mapping_preview: false,
  auto_save_template_after_fill: true,
  enable_llm_comment: false,
  llm_provider: 'anthropic',
  llm_api_key: '',
  llm_model: 'claude-sonnet-4-6',
  llm_custom_endpoint: '',
};

const storage = createStorage<ExtensionSettings>(
  'extension-settings-storage-key',
  defaultSettings,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const extensionSettingsStorage = {
  ...storage,

  get: async (): Promise<ExtensionSettings> => ({
    ...defaultSettings,
    ...(await storage.get()),
  }),

  /**
   * 更新设置
   */
  updateSettings: async (updates: Partial<ExtensionSettings>): Promise<void> => {
    await storage.set(current => ({
      ...current,
      ...updates,
    }));
  },
};
