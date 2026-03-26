import '@src/Options.css';
import { CollectionPanel } from './components/CollectionPanel';
import { ExternalLinksPanel } from './components/ExternalLinksPanel';
import { ManagedBacklinksPanel } from './components/ManagedBacklinksPanel';
import { MvpSettingsPanel } from './components/MvpSettingsPanel';
import { OwnedSitesPanel } from './components/OwnedSitesPanel';
import { WebsiteProfilesPanel } from './components/WebsiteProfilesPanel';
import { useExternalLinks } from './hooks/useExternalLinks';
import { useManagedBacklinks } from './hooks/useManagedBacklinks';
import { useOwnedSites } from './hooks/useOwnedSites';
import { useWebsiteProfiles } from './hooks/useWebsiteProfiles';
import { generateExternalLinkMetadata, withErrorBoundary, withSuspense } from '@extension/shared';
import { extensionSettingsStorage, managedBacklinkStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useMemo, useState } from 'react';
import type { ManagedBacklink, WebsiteProfile } from '@extension/shared';

type TabType = 'websites' | 'backlinks' | 'new-websites' | 'new-backlinks' | 'collection' | 'settings';

const Options = () => {
  const [activeTab, setActiveTab] = useState<TabType>('new-backlinks');
  const {
    profiles,
    groups: websiteGroups,
    loading: websitesLoading,
    error: websitesError,
    addProfile,
    updateProfile,
    deleteProfile,
    addGroup: addWebsiteGroup,
  } = useWebsiteProfiles();
  const {
    backlinks,
    groups: backlinkGroups,
    loading: backlinksLoading,
    error: backlinksError,
    addBacklink,
    updateBacklink,
    deleteBacklink,
    addGroup: addBacklinkGroup,
  } = useManagedBacklinks();
  const {
    sites: ownedSites,
    metadataMap: ownedMetadataMap,
    profiles: ownedProfiles,
    loading: ownedSitesLoading,
    deleteSite,
    addSite,
  } = useOwnedSites();
  const {
    links: externalLinks,
    metadataMap: externalMetadataMap,
    loading: externalLinksLoading,
    deleteLink,
    addLink,
    toggleFavorite,
    checkLinkAvailability,
    setMetadata: setExternalLinkMetadata,
  } = useExternalLinks();
  const [uniqueByDomain, setUniqueByDomain] = useState(true);

  useEffect(() => {
    void extensionSettingsStorage.get().then(settings => {
      setUniqueByDomain(settings.unique_backlink_domain);
    });
  }, []);

  const tabs = useMemo(
    () => [
      { id: 'new-backlinks' as const, label: '外链管理', count: externalLinks.length },
      { id: 'new-websites' as const, label: '我的网站', count: ownedSites.length },
      { id: 'backlinks' as const, label: '旧版外链', count: backlinks.length },
      { id: 'websites' as const, label: '旧版网站', count: profiles.length },
      { id: 'collection' as const, label: '外链采集' },
      { id: 'settings' as const, label: '设置' },
    ],
    [backlinks.length, externalLinks.length, ownedSites.length, profiles.length],
  );

  const handleSaveProfile = async (profile: WebsiteProfile, isEditing: boolean) => {
    if (isEditing) {
      await updateProfile(profile.id, profile);
    } else {
      await addProfile(profile);
    }
  };

  const handleSaveBacklink = async (backlink: ManagedBacklink, isEditing: boolean) => {
    const hasSameUrl = await managedBacklinkStorage.hasUrlInGroup(
      backlink.url,
      backlink.group_id,
      isEditing ? backlink.id : undefined,
    );
    if (hasSameUrl) {
      throw new Error('同分组下已存在相同 URL 的外链');
    }

    const settings = await extensionSettingsStorage.get();
    if (settings.unique_backlink_domain) {
      const hasSameDomain = await managedBacklinkStorage.hasDomainInGroup(
        backlink.domain,
        backlink.group_id,
        isEditing ? backlink.id : undefined,
      );
      if (hasSameDomain) {
        throw new Error('已开启域名唯一，同分组下已存在相同域名');
      }
    }

    if (isEditing) {
      await updateBacklink(backlink.id, backlink);
    } else {
      await addBacklink(backlink);
    }
  };

  const handleOpenBacklink = async (backlinkId: string, queueIds: string[], groupId?: string) => {
    const response = await chrome.runtime.sendMessage({
      type: 'OPEN_MANAGED_BACKLINK',
      payload: { backlinkId, queueIds, groupId },
    });

    if (!response?.success) {
      throw new Error(response?.error || '打开外链失败');
    }
  };

  const handleOpenFiltered = async (queueIds: string[], groupId?: string) => {
    if (!queueIds.length) {
      return;
    }
    await handleOpenBacklink(queueIds[0], queueIds, groupId);
  };

  const handleCollectBacklink = async (url: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_MANUAL_COLLECTION',
        payload: { targetUrl: url },
      });

      if (!response?.success) {
        throw new Error(response?.error || '采集失败');
      }

      alert(`采集成功！共采集 ${response.count} 条外链`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '采集失败');
    }
  };

  const handleCollectExternalMetadata = async (url: string) => {
    const metadata = await generateExternalLinkMetadata(url);
    if (metadata) {
      metadata.linkId = `ext-link-${Date.now()}`;
      await setExternalLinkMetadata(metadata);
    }
    return metadata;
  };

  const handleCheckExternalAvailability = async (id: string, url: string) => {
    await checkLinkAvailability(id, url);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="flex-shrink-0 bg-white shadow dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <h1 className="text-2xl font-bold">Link Pilot 管理面板</h1>
          <p className="mt-1 text-sm text-gray-500">我的网站 → 外链管理 → 一键填表 · 动态字段版</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-6">
          <div className="mb-6 flex flex-shrink-0 gap-2 border-b dark:border-gray-700">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-t px-4 py-2 text-sm font-medium',
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                )}>
                {tab.label}
                {'count' in tab && typeof tab.count === 'number' ? ` (${tab.count})` : ''}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'new-backlinks' && (
              <div>
                {externalLinksLoading ? (
                  <LoadingSpinner />
                ) : (
                  <ExternalLinksPanel
                    links={externalLinks}
                    metadataMap={externalMetadataMap}
                    onAddLink={addLink}
                    onDeleteLink={deleteLink}
                    onCollectMetadata={handleCollectExternalMetadata}
                    onCheckAvailability={handleCheckExternalAvailability}
                    onToggleFavorite={toggleFavorite}
                  />
                )}
              </div>
            )}

            {activeTab === 'new-websites' && (
              <div>
                {ownedSitesLoading ? (
                  <LoadingSpinner />
                ) : (
                  <OwnedSitesPanel
                    sites={ownedSites}
                    metadataMap={ownedMetadataMap}
                    profiles={ownedProfiles}
                    onAddSite={addSite}
                    onDeleteSite={deleteSite}
                  />
                )}
              </div>
            )}

            {activeTab === 'websites' && (
              <div>
                {websitesError && <ErrorDisplay error={new Error(websitesError)} />}
                {websitesLoading ? (
                  <LoadingSpinner />
                ) : (
                  <WebsiteProfilesPanel
                    profiles={profiles}
                    groups={websiteGroups}
                    onSaveProfile={handleSaveProfile}
                    onDeleteProfile={deleteProfile}
                    onAddGroup={async name => {
                      await addWebsiteGroup({
                        id: `website-group-${Date.now()}`,
                        name,
                        website_count: 0,
                        created_at: new Date().toISOString(),
                      });
                    }}
                  />
                )}
              </div>
            )}

            {activeTab === 'backlinks' && (
              <div>
                {backlinksError && <ErrorDisplay error={new Error(backlinksError)} />}
                {backlinksLoading ? (
                  <LoadingSpinner />
                ) : (
                  <ManagedBacklinksPanel
                    backlinks={backlinks}
                    groups={backlinkGroups}
                    uniqueByDomain={uniqueByDomain}
                    onSaveBacklink={handleSaveBacklink}
                    onDeleteBacklink={deleteBacklink}
                    onAddGroup={async name => {
                      await addBacklinkGroup({
                        id: `managed-backlink-group-${Date.now()}`,
                        name,
                        backlink_count: 0,
                        created_at: new Date().toISOString(),
                      });
                    }}
                    onOpenBacklink={handleOpenBacklink}
                    onOpenFiltered={handleOpenFiltered}
                    onCollectBacklink={handleCollectBacklink}
                  />
                )}
              </div>
            )}

            {activeTab === 'collection' && <CollectionPanel />}

            {activeTab === 'settings' && <MvpSettingsPanel />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
