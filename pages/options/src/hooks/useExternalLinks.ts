/**
 * ExternalLink 系列数据 Hook
 */

import { checkAvailability, LinkAvailabilityStatus } from '@extension/shared';
import { externalLinkStorage, externalLinkMetadataStorage, externalLinkProfileStorage } from '@extension/storage';
import { useEffect, useState } from 'react';
import type { ExternalLink, ExternalLinkMetadata, ExternalLinkProfile } from '@extension/shared';

export const useExternalLinks = () => {
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [metadataMap, setMetadataMap] = useState<Record<string, ExternalLinkMetadata>>({});
  const [profiles, setProfiles] = useState<Record<string, ExternalLinkProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const linksData = await externalLinkStorage.getAll();
      setLinks(linksData);

      const metaMap: Record<string, ExternalLinkMetadata> = {};
      for (const link of linksData) {
        const meta = await externalLinkMetadataStorage.get(link.id);
        if (meta) {
          metaMap[link.id] = meta;
        }
      }
      setMetadataMap(metaMap);

      const profileMap: Record<string, ExternalLinkProfile> = {};
      for (const link of linksData) {
        const profile = await externalLinkProfileStorage.get(link.id);
        if (profile) {
          profileMap[link.id] = profile;
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

    const unsubLink = externalLinkStorage.subscribe(() => {
      void loadData();
    });
    const unsubMeta = externalLinkMetadataStorage.subscribe(() => {
      void loadData();
    });
    const unsubProfile = externalLinkProfileStorage.subscribe(() => {
      void loadData();
    });

    return () => {
      unsubLink();
      unsubMeta();
      unsubProfile();
    };
  }, []);

  const addLink = async (link: ExternalLink) => {
    await externalLinkStorage.add(link);
  };

  const updateLink = async (id: string, updates: Partial<ExternalLink>) => {
    await externalLinkStorage.update(id, updates);
  };

  const deleteLink = async (id: string) => {
    await externalLinkStorage.delete(id);
    await externalLinkMetadataStorage.delete(id);
    await externalLinkProfileStorage.delete(id);
  };

  const toggleFavorite = async (id: string) => {
    await externalLinkStorage.toggleFavorite(id);
  };

  const checkLinkAvailability = async (id: string, url: string) => {
    await externalLinkStorage.updateStatus(id, LinkAvailabilityStatus.CHECKING);
    const result = await checkAvailability(url);
    await externalLinkStorage.updateStatus(id, result.status, result.checkedAt);
  };

  const setMetadata = async (metadata: ExternalLinkMetadata) => {
    await externalLinkMetadataStorage.set(metadata);
  };

  const setProfile = async (profile: ExternalLinkProfile) => {
    await externalLinkProfileStorage.upsert(profile);
  };

  return {
    links,
    metadataMap,
    profiles,
    loading,
    error,
    refresh: loadData,
    addLink,
    updateLink,
    deleteLink,
    toggleFavorite,
    checkLinkAvailability,
    setMetadata,
    setProfile,
  };
};
