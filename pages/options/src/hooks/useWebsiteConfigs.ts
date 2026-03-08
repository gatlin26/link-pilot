import { useEffect, useState } from 'react';
import { websiteConfigStorage } from '@extension/storage';
import type { WebsiteConfig, WebsiteGroup } from '@extension/shared';

export const useWebsiteConfigs = () => {
  const [configs, setConfigs] = useState<WebsiteConfig[]>([]);
  const [groups, setGroups] = useState<WebsiteGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [configsData, groupsData] = await Promise.all([
        websiteConfigStorage.getAllConfigs(),
        websiteConfigStorage.getAllGroups(),
      ]);
      setConfigs(configsData);
      setGroups(groupsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addConfig = async (config: WebsiteConfig) => {
    try {
      await websiteConfigStorage.addConfig(config);
      await loadData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '添加失败');
    }
  };

  const updateConfig = async (id: string, updates: Partial<WebsiteConfig>) => {
    try {
      await websiteConfigStorage.updateConfig(id, updates);
      await loadData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '更新失败');
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      await websiteConfigStorage.deleteConfig(id);
      await loadData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const addGroup = async (group: WebsiteGroup) => {
    try {
      await websiteConfigStorage.addGroup(group);
      await loadData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '添加分组失败');
    }
  };

  const updateGroup = async (id: string, updates: Partial<WebsiteGroup>) => {
    try {
      await websiteConfigStorage.updateGroup(id, updates);
      await loadData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '更新分组失败');
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      await websiteConfigStorage.deleteGroup(id);
      await loadData();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '删除分组失败');
    }
  };

  return {
    configs,
    groups,
    loading,
    error,
    refresh: loadData,
    addConfig,
    updateConfig,
    deleteConfig,
    addGroup,
    updateGroup,
    deleteGroup,
  };
};
