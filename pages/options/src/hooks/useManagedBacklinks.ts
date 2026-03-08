import { useEffect, useState } from 'react';
import { managedBacklinkStorage } from '@extension/storage';
import type { ManagedBacklink, ManagedBacklinkGroup } from '@extension/shared';

export const useManagedBacklinks = () => {
  const [backlinks, setBacklinks] = useState<ManagedBacklink[]>([]);
  const [groups, setGroups] = useState<ManagedBacklinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [backlinksData, groupsData] = await Promise.all([
        managedBacklinkStorage.getAllBacklinks(),
        managedBacklinkStorage.getAllGroups(),
      ]);
      setBacklinks(backlinksData);
      setGroups(groupsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    const unsubscribe = managedBacklinkStorage.subscribe(() => {
      void loadData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    backlinks,
    groups,
    loading,
    error,
    refresh: loadData,
    addBacklink: managedBacklinkStorage.addBacklink,
    updateBacklink: managedBacklinkStorage.updateBacklink,
    deleteBacklink: managedBacklinkStorage.deleteBacklink,
    addGroup: managedBacklinkStorage.addGroup,
    updateGroup: managedBacklinkStorage.updateGroup,
    deleteGroup: managedBacklinkStorage.deleteGroup,
  };
};
