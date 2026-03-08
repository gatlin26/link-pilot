import { useEffect, useState } from 'react';
import { backlinkGroupStorage } from '@extension/storage';
import type { BacklinkGroup } from '@extension/shared';

export const useBacklinkGroups = () => {
  const [groups, setGroups] = useState<BacklinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await backlinkGroupStorage.getAll();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const addGroup = async (group: BacklinkGroup) => {
    try {
      await backlinkGroupStorage.add(group);
      await loadGroups();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '添加失败');
    }
  };

  const updateGroup = async (id: string, updates: Partial<BacklinkGroup>) => {
    try {
      await backlinkGroupStorage.update(id, updates);
      await loadGroups();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '更新失败');
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      await backlinkGroupStorage.delete(id);
      await loadGroups();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return {
    groups,
    loading,
    error,
    refresh: loadGroups,
    addGroup,
    updateGroup,
    deleteGroup,
  };
};
