/**
 * 同步设置存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';

export interface SyncSettings {
  webAppUrl: string;
  syncIntervalMinutes: number;
}

const DEFAULT_SETTINGS: SyncSettings = {
  webAppUrl: '',
  syncIntervalMinutes: 5,
};

export interface SyncSettingsStorageState {
  settings: SyncSettings;
  lastUpdated: string;
}

const storage = createStorage<SyncSettingsStorageState>(
  'sync-settings-storage-key',
  {
    settings: DEFAULT_SETTINGS,
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const syncSettingsStorage = {
  ...storage,

  get: async (): Promise<SyncSettings> => {
    const state = await storage.get();
    return state.settings;
  },

  set: async (settings: SyncSettings): Promise<void> => {
    await storage.set({
      settings,
      lastUpdated: new Date().toISOString(),
    });
  },

  update: async (updates: Partial<SyncSettings>): Promise<SyncSettings> => {
    const current = await storage.get();
    const nextSettings = {
      ...current.settings,
      ...updates,
    };

    await storage.set({
      settings: nextSettings,
      lastUpdated: new Date().toISOString(),
    });

    return nextSettings;
  },
};
