import { useEffect, useState } from 'react';
import { websiteProfileStorage } from '@extension/storage';
import type { WebsiteProfile, WebsiteProfileGroup } from '@extension/shared';

export const useWebsiteProfiles = () => {
  const [profiles, setProfiles] = useState<WebsiteProfile[]>([]);
  const [groups, setGroups] = useState<WebsiteProfileGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profilesData, groupsData] = await Promise.all([
        websiteProfileStorage.getAllProfiles(),
        websiteProfileStorage.getAllGroups(),
      ]);
      setProfiles(profilesData);
      setGroups(groupsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    const unsubscribe = websiteProfileStorage.subscribe(() => {
      void loadData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    profiles,
    groups,
    loading,
    error,
    refresh: loadData,
    addProfile: websiteProfileStorage.addProfile,
    updateProfile: websiteProfileStorage.updateProfile,
    deleteProfile: websiteProfileStorage.deleteProfile,
    addGroup: websiteProfileStorage.addGroup,
    updateGroup: websiteProfileStorage.updateGroup,
    deleteGroup: websiteProfileStorage.deleteGroup,
  };
};
