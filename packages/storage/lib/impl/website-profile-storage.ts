import { createStorage, StorageEnum } from '../base/index.js';
import type { WebsiteProfile, WebsiteProfileGroup } from '@extension/shared';

interface WebsiteProfileStorageState {
  profiles: WebsiteProfile[];
  groups: WebsiteProfileGroup[];
  lastUpdated: string;
}

const defaultGroup: WebsiteProfileGroup = {
  id: 'default',
  name: '默认分组',
  website_count: 0,
  created_at: new Date().toISOString(),
};

const storage = createStorage<WebsiteProfileStorageState>(
  'website-profile-storage-key',
  {
    profiles: [],
    groups: [defaultGroup],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const recalcGroups = (groups: WebsiteProfileGroup[], profiles: WebsiteProfile[]) =>
  groups.map(group => ({
    ...group,
    website_count: profiles.filter(profile => profile.group_id === group.id).length,
  }));

export const websiteProfileStorage = {
  ...storage,

  async getAllProfiles(): Promise<WebsiteProfile[]> {
    const state = await storage.get();
    return state.profiles;
  },

  async getEnabledProfiles(): Promise<WebsiteProfile[]> {
    const state = await storage.get();
    return state.profiles.filter(profile => profile.enabled);
  },

  async getProfileById(id: string): Promise<WebsiteProfile | null> {
    const state = await storage.get();
    return state.profiles.find(profile => profile.id === id) ?? null;
  },

  async addProfile(profile: WebsiteProfile): Promise<void> {
    await storage.set(state => {
      const profiles = [...state.profiles, profile];
      return {
        ...state,
        profiles,
        groups: recalcGroups(state.groups, profiles),
        lastUpdated: new Date().toISOString(),
      };
    });
  },

  async updateProfile(id: string, updates: Partial<WebsiteProfile>): Promise<void> {
    await storage.set(state => {
      const profiles = state.profiles.map(profile =>
        profile.id === id ? { ...profile, ...updates, updated_at: new Date().toISOString() } : profile,
      );
      return {
        ...state,
        profiles,
        groups: recalcGroups(state.groups, profiles),
        lastUpdated: new Date().toISOString(),
      };
    });
  },

  async deleteProfile(id: string): Promise<void> {
    await storage.set(state => {
      const profiles = state.profiles.filter(profile => profile.id !== id);
      return {
        ...state,
        profiles,
        groups: recalcGroups(state.groups, profiles),
        lastUpdated: new Date().toISOString(),
      };
    });
  },

  async getAllGroups(): Promise<WebsiteProfileGroup[]> {
    const state = await storage.get();
    return state.groups;
  },

  async addGroup(group: WebsiteProfileGroup): Promise<void> {
    await storage.set(state => ({
      ...state,
      groups: [...state.groups, group],
      lastUpdated: new Date().toISOString(),
    }));
  },

  async updateGroup(id: string, updates: Partial<WebsiteProfileGroup>): Promise<void> {
    await storage.set(state => ({
      ...state,
      groups: state.groups.map(group => (group.id === id ? { ...group, ...updates } : group)),
      lastUpdated: new Date().toISOString(),
    }));
  },

  async deleteGroup(id: string): Promise<void> {
    if (id === defaultGroup.id) {
      throw new Error('默认分组不能删除');
    }

    await storage.set(state => {
      const profiles = state.profiles.map(profile =>
        profile.group_id === id ? { ...profile, group_id: defaultGroup.id, updated_at: new Date().toISOString() } : profile,
      );
      const groups = state.groups.filter(group => group.id !== id);
      return {
        ...state,
        profiles,
        groups: recalcGroups(groups, profiles),
        lastUpdated: new Date().toISOString(),
      };
    });
  },
};
