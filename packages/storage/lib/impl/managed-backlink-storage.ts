import { createStorage, StorageEnum } from '../base/index.js';
import type { ManagedBacklink, ManagedBacklinkGroup } from '@extension/shared';

interface ManagedBacklinkStorageState {
  backlinks: ManagedBacklink[];
  groups: ManagedBacklinkGroup[];
  lastUpdated: string;
}

const defaultGroup: ManagedBacklinkGroup = {
  id: 'default',
  name: '默认分组',
  backlink_count: 0,
  created_at: new Date().toISOString(),
};

const storage = createStorage<ManagedBacklinkStorageState>(
  'managed-backlink-storage-key',
  {
    backlinks: [],
    groups: [defaultGroup],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

const recalcGroups = (groups: ManagedBacklinkGroup[], backlinks: ManagedBacklink[]) =>
  groups.map(group => ({
    ...group,
    backlink_count: backlinks.filter(backlink => backlink.group_id === group.id).length,
  }));

const normalizeUrl = (value: string) => value.trim().replace(/\/$/, '').toLowerCase();
const normalizeDomain = (value: string) => value.trim().toLowerCase();

function normalizeBacklink(backlink: ManagedBacklink): ManagedBacklink {
  return {
    ...backlink,
    title: backlink.title?.trim() || undefined,
    description: backlink.description?.trim() || undefined,
    site_type: backlink.site_type ?? 'blog_comment',
    pricing: backlink.pricing ?? 'free',
    language: backlink.language?.trim() || undefined,
    is_available: backlink.is_available ?? true,
    note: backlink.note?.trim() || undefined,
    keywords: Array.from(new Set((backlink.keywords ?? []).map(keyword => keyword.trim()).filter(Boolean))),
  };
}

export const managedBacklinkStorage = {
  ...storage,

  async getAllBacklinks(): Promise<ManagedBacklink[]> {
    const state = await storage.get();
    return state.backlinks.map(normalizeBacklink);
  },

  async getBacklinkById(id: string): Promise<ManagedBacklink | null> {
    const state = await storage.get();
    const backlink = state.backlinks.find(item => item.id === id);
    return backlink ? normalizeBacklink(backlink) : null;
  },

  async getAllGroups(): Promise<ManagedBacklinkGroup[]> {
    const state = await storage.get();
    return state.groups;
  },

  async hasUrlInGroup(url: string, groupId: string, excludeId?: string): Promise<boolean> {
    const state = await storage.get();
    const normalizedUrl = normalizeUrl(url);
    return state.backlinks.some(backlink => backlink.id !== excludeId && backlink.group_id === groupId && normalizeUrl(backlink.url) === normalizedUrl);
  },

  async hasDomainInGroup(domain: string, groupId: string, excludeId?: string): Promise<boolean> {
    const state = await storage.get();
    const normalizedDomain = normalizeDomain(domain);
    return state.backlinks.some(backlink => backlink.id !== excludeId && backlink.group_id === groupId && normalizeDomain(backlink.domain) === normalizedDomain);
  },

  async addBacklink(backlink: ManagedBacklink): Promise<void> {
    await storage.set(state => {
      const backlinks = [...state.backlinks, normalizeBacklink(backlink)];
      return {
        ...state,
        backlinks,
        groups: recalcGroups(state.groups, backlinks),
        lastUpdated: new Date().toISOString(),
      };
    });
  },

  async updateBacklink(id: string, updates: Partial<ManagedBacklink>): Promise<void> {
    await storage.set(state => {
      const backlinks = state.backlinks.map(backlink =>
        backlink.id === id ? normalizeBacklink({ ...backlink, ...updates, updated_at: new Date().toISOString() }) : backlink,
      );
      return {
        ...state,
        backlinks,
        groups: recalcGroups(state.groups, backlinks),
        lastUpdated: new Date().toISOString(),
      };
    });
  },

  async deleteBacklink(id: string): Promise<void> {
    await storage.set(state => {
      const backlinks = state.backlinks.filter(backlink => backlink.id !== id);
      return {
        ...state,
        backlinks,
        groups: recalcGroups(state.groups, backlinks),
        lastUpdated: new Date().toISOString(),
      };
    });
  },

  async addGroup(group: ManagedBacklinkGroup): Promise<void> {
    await storage.set(state => ({
      ...state,
      groups: [...state.groups, group],
      lastUpdated: new Date().toISOString(),
    }));
  },

  async updateGroup(id: string, updates: Partial<ManagedBacklinkGroup>): Promise<void> {
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
      const backlinks = state.backlinks.map(backlink =>
        backlink.group_id === id ? { ...backlink, group_id: defaultGroup.id, updated_at: new Date().toISOString() } : backlink,
      );
      const groups = state.groups.filter(group => group.id !== id);
      return {
        ...state,
        backlinks,
        groups: recalcGroups(groups, backlinks),
        lastUpdated: new Date().toISOString(),
      };
    });
  },
};
