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
