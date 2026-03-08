import '@src/Options.css';
import { useEffect, useMemo, useState } from 'react';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { extensionSettingsStorage, managedBacklinkStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import type { ManagedBacklink, WebsiteProfile } from '@extension/shared';
import { useWebsiteProfiles } from './hooks/useWebsiteProfiles';
import { useManagedBacklinks } from './hooks/useManagedBacklinks';
import { WebsiteProfilesPanel } from './components/WebsiteProfilesPanel';
import { ManagedBacklinksPanel } from './components/ManagedBacklinksPanel';
import { MvpSettingsPanel } from './components/MvpSettingsPanel';
import { CollectionPanel } from './components/CollectionPanel';

type TabType = 'websites' | 'backlinks' | 'collection' | 'settings';

const Options = () => {
  const [activeTab, setActiveTab] = useState<TabType>('websites');
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
  const [uniqueByDomain, setUniqueByDomain] = useState(true);

  useEffect(() => {
    void extensionSettingsStorage.get().then(settings => {
      setUniqueByDomain(settings.unique_backlink_domain);
    });
  }, []);

  const tabs = useMemo(
    () => [
      { id: 'websites' as const, label: '我的网站', count: profiles.length },
      { id: 'backlinks' as const, label: '外链管理', count: backlinks.length },
      { id: 'collection' as const, label: '外链采集' },
      { id: 'settings' as const, label: '设置' },
    ],
    [backlinks.length, profiles.length],
  );

  const handleSaveProfile = async (profile: WebsiteProfile, isEditing: boolean) => {
    if (isEditing) {
      await updateProfile(profile.id, profile);
    } else {
      await addProfile(profile);
    }
  };

  const handleSaveBacklink = async (backlink: ManagedBacklink, isEditing: boolean) => {
    const hasSameUrl = await managedBacklinkStorage.hasUrlInGroup(backlink.url, backlink.group_id, isEditing ? backlink.id : undefined);
    if (hasSameUrl) {
      throw new Error('同分组下已存在相同 URL 的外链');
    }

    const settings = await extensionSettingsStorage.get();
    if (settings.unique_backlink_domain) {
      const hasSameDomain = await managedBacklinkStorage.hasDomainInGroup(backlink.domain, backlink.group_id, isEditing ? backlink.id : undefined);
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

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Link Pilot MVP 管理面板</h1>
          <p className="text-sm text-gray-500 mt-1">只保留“我的网站 → 外链管理 → 一键填表”闭环。</p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 py-6 flex flex-col h-full">
          <div className="flex gap-2 mb-6 border-b dark:border-gray-700 flex-shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 rounded-t text-sm font-medium',
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                )}
              >
                {tab.label}
                {'count' in tab && typeof tab.count === 'number' ? ` (${tab.count})` : ''}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
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
