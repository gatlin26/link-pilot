/**
 * OwnedSite 系列数据 Hook
 */

import { ownedSiteStorage, ownedSiteMetadataStorage, ownedSiteProfileStorage } from '@extension/storage';
import { useEffect, useState } from 'react';
import type { OwnedSite, OwnedSiteMetadata, OwnedSiteProfile } from '@extension/shared';

export const useOwnedSites = () => {
  const [sites, setSites] = useState<OwnedSite[]>([]);
  const [metadataMap, setMetadataMap] = useState<Record<string, OwnedSiteMetadata>>({});
  const [profiles, setProfiles] = useState<Record<string, OwnedSiteProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const sitesData = await ownedSiteStorage.getAll();
      setSites(sitesData);

      // 加载所有 metadata
      const metaMap: Record<string, OwnedSiteMetadata> = {};
      for (const site of sitesData) {
        const meta = await ownedSiteMetadataStorage.get(site.id);
        if (meta) {
          metaMap[site.id] = meta;
        }
      }
      setMetadataMap(metaMap);

      // 加载所有 profiles
      const profileMap: Record<string, OwnedSiteProfile> = {};
      for (const site of sitesData) {
        const profile = await ownedSiteProfileStorage.get(site.id);
        if (profile) {
          profileMap[site.id] = profile;
        }
      }
      setProfiles(profileMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    const unsubSite = ownedSiteStorage.subscribe(() => {
      void loadData();
    });
    const unsubMeta = ownedSiteMetadataStorage.subscribe(() => {
      void loadData();
    });
    const unsubProfile = ownedSiteProfileStorage.subscribe(() => {
      void loadData();
    });

    return () => {
      unsubSite();
      unsubMeta();
      unsubProfile();
    };
  }, []);

  const addSite = async (site: OwnedSite) => {
    await ownedSiteStorage.add(site);
  };

  const updateSite = async (id: string, updates: Partial<OwnedSite>) => {
    await ownedSiteStorage.update(id, updates);
  };

  const deleteSite = async (id: string) => {
    await ownedSiteStorage.delete(id);
    await ownedSiteMetadataStorage.delete(id);
    await ownedSiteProfileStorage.delete(id);
  };

  const setMetadata = async (metadata: OwnedSiteMetadata) => {
    await ownedSiteMetadataStorage.set(metadata);
  };

  const setProfile = async (profile: OwnedSiteProfile) => {
    await ownedSiteProfileStorage.upsert(profile);
  };

  return {
    sites,
    metadataMap,
    profiles,
    loading,
    error,
    refresh: loadData,
    addSite,
    updateSite,
    deleteSite,
    setMetadata,
    setProfile,
  };
};
