import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@extension/shared';
import {
  exampleThemeStorage,
  managedBacklinkStorage,
  submissionSessionStorage,
  websiteProfileStorage,
} from '@extension/storage';
import { cn, LoadingSpinner } from '@extension/ui';
import { MessageType } from '@extension/shared';
import type { FillPageState, ManagedBacklink, WebsiteProfile, WebsiteProfileGroup } from '@extension/shared';
import { useSubmissionSession } from '../../popup/src/hooks/useSubmissionSession';
import { buildCommentCandidates } from '../../popup/src/utils/comment-generator';
import { ManualCollector } from '../../popup/src/components/ManualCollector';

type SidePanelTab = 'fill' | 'backlinks' | 'collection';

function resolveCollectionTargetUrl(rawUrl: string): string {
  const currentUrl = new URL(rawUrl);
  const ahrefsInput = currentUrl.searchParams.get('input');

  if (ahrefsInput) {
    try {
      const decoded = decodeURIComponent(ahrefsInput);
      const target = new URL(decoded);
      return `${target.protocol}//${target.hostname}/`;
    } catch {
      return ahrefsInput;
    }
  }

  return `${currentUrl.protocol}//${currentUrl.hostname}/`;
}

export const SidePanelView = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const { session, loading: sessionLoading, updateSession } = useSubmissionSession();
  const [activeTab, setActiveTab] = useState<SidePanelTab>('fill');
  const [profiles, setProfiles] = useState<WebsiteProfile[]>([]);
  const [groups, setGroups] = useState<WebsiteProfileGroup[]>([]);
  const [backlinks, setBacklinks] = useState<ManagedBacklink[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('default');
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>('');
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(0);
  const [pageState, setPageState] = useState<FillPageState | null>(null);
  const [loadingPageState, setLoadingPageState] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [backlinkSearch, setBacklinkSearch] = useState('');
  const [backlinkKeyword, setBacklinkKeyword] = useState('');
  const [backlinkNote, setBacklinkNote] = useState('');
  const [selectedBacklinkGroupId, setSelectedBacklinkGroupId] = useState('all');
  const [collectingCurrentSite, setCollectingCurrentSite] = useState(false);

  const enabledProfiles = useMemo(() => profiles.filter(profile => profile.enabled), [profiles]);
  const groupProfiles = useMemo(
    () => enabledProfiles.filter(profile => profile.group_id === selectedGroupId),
    [enabledProfiles, selectedGroupId],
  );
  const selectedProfile = useMemo(
    () => enabledProfiles.find(profile => profile.id === selectedWebsiteId) ?? groupProfiles[0] ?? enabledProfiles[0] ?? null,
    [enabledProfiles, groupProfiles, selectedWebsiteId],
  );
  const currentBacklink = useMemo(
    () => backlinks.find(backlink => backlink.id === session.current_backlink_id) ?? null,
    [backlinks, session.current_backlink_id],
  );
  const currentBacklinkGroup = useMemo(
    () => currentBacklink?.group_id ?? session.selected_backlink_group_id,
    [currentBacklink?.group_id, session.selected_backlink_group_id],
  );
  const generatedComments = useMemo(
    () => (selectedProfile ? buildCommentCandidates(selectedProfile, pageState, currentBacklink) : []),
    [currentBacklink, pageState, selectedProfile],
  );

  const filteredBacklinks = useMemo(() => {
    return backlinks.filter(backlink => {
      const matchesGroup = selectedBacklinkGroupId === 'all' || backlink.group_id === selectedBacklinkGroupId;
      const matchesUrl = !backlinkSearch || backlink.url.toLowerCase().includes(backlinkSearch.toLowerCase());
      const matchesNote = !backlinkNote || (backlink.note ?? '').toLowerCase().includes(backlinkNote.toLowerCase());
      const matchesKeyword = !backlinkKeyword || backlink.keywords.some(keyword => keyword.toLowerCase().includes(backlinkKeyword.toLowerCase()));
      return matchesGroup && matchesUrl && matchesNote && matchesKeyword;
    });
  }, [backlinks, selectedBacklinkGroupId, backlinkSearch, backlinkNote, backlinkKeyword]);

  useEffect(() => {
    void loadProfiles();
    void loadBacklinks();
    void refreshPageState(false);
  }, []);

  const loadProfiles = async () => {
    try {
      const [profiles, groups] = await Promise.all([
        websiteProfileStorage.getAllProfiles(),
        websiteProfileStorage.getAllGroups(),
      ]);
      setProfiles(profiles);
      setGroups(groups);
    } catch (error) {
      console.error('加载网站资料失败:', error);
    }
  };

  const loadBacklinks = async () => {
    try {
      const data = await managedBacklinkStorage.getAllBacklinks();
      setBacklinks(data);
    } catch (error) {
      console.error('加载外链失败:', error);
    }
  };

  const refreshPageState = async (showMessage: boolean) => {
    setLoadingPageState(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('无法获取当前标签页');
      }

      const response = await chrome.tabs.sendMessage(tab.id, { type: MessageType.GET_PAGE_STATE });
      setPageState(response);
      if (showMessage) {
        setMessage('页面状态已刷新');
        setTimeout(() => setMessage(null), 2000);
      }
    } catch (error) {
      console.error('获取页面状态失败:', error);
      setPageState(null);
    } finally {
      setLoadingPageState(false);
    }
  };

  const locateNextForm = async () => {
    setWorking(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('无法获取当前标签页');

      await chrome.tabs.sendMessage(tab.id, { type: MessageType.LOCATE_NEXT_FORM });
      setMessage('已定位到下一个表单');
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '定位表单失败');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setWorking(false);
    }
  };

  const performFill = async () => {
    if (!selectedProfile) {
      setErrorMessage('请先选择网站资料');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setWorking(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('无法获取当前标签页');

      const comment = generatedComments[selectedCommentIndex] || '';
      await chrome.tabs.sendMessage(tab.id, {
        type: MessageType.FILL_FORM,
        payload: { profile: selectedProfile, comment, backlink: currentBacklink },
      });

      setMessage('表单填写完成');
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '填表失败');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setWorking(false);
    }
  };

  const openBacklinkFromPopup = async (backlinkId: string, groupId?: string) => {
    setWorking(true);
    try {
      const queueIds = filteredBacklinks.map(b => b.id);
      const response = await chrome.runtime.sendMessage({
        type: 'OPEN_MANAGED_BACKLINK',
        payload: { backlinkId, queueIds, groupId },
      });

      if (!response?.success) {
        throw new Error(response?.error || '打开外链失败');
      }

      await updateSession({
        current_backlink_id: backlinkId,
        queue_backlink_ids: queueIds,
        queue_cursor: queueIds.indexOf(backlinkId),
        selected_backlink_group_id: groupId,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '打开外链失败');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setWorking(false);
    }
  };

  const openNextBacklinks = async () => {
    setWorking(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'OPEN_NEXT_BACKLINKS',
        payload: {},
      });

      if (!response?.success) {
        throw new Error(response?.error || '打开下一个外链失败');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '打开下一个外链失败');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setWorking(false);
    }
  };

  const collectCurrentSite = async () => {
    setCollectingCurrentSite(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) {
        throw new Error('无法获取当前页面 URL');
      }

      const targetUrl = resolveCollectionTargetUrl(tab.url);

      const response = await chrome.runtime.sendMessage({
        type: 'START_MANUAL_COLLECTION',
        payload: {
          targetUrl,
          groupId: selectedBacklinkGroupId === 'all' ? undefined : selectedBacklinkGroupId,
        },
      });

      if (!response?.success) {
        throw new Error(response?.error || '采集失败');
      }

      const collectedCount = Number(response.count || 0);
      const addedToLibrary = Number(response.addedToLibrary ?? 0);
      const skippedInLibrary = Number(response.skippedInLibrary ?? 0);
      setMessage(
        skippedInLibrary > 0
          ? `采集完成：共 ${collectedCount} 条，新增到外链库 ${addedToLibrary} 条，跳过重复 ${skippedInLibrary} 条`
          : `采集完成：共 ${collectedCount} 条，新增到外链库 ${addedToLibrary} 条`,
      );
      setTimeout(() => setMessage(null), 3000);
      await loadBacklinks();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '采集当前站点失败');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setCollectingCurrentSite(false);
    }
  };

  return (
    <div className={cn('w-full h-full flex flex-col overflow-hidden', isLight ? 'bg-slate-50' : 'bg-gray-900')}>
      {/* 头部 */}
      <div className={cn('flex-shrink-0 px-4 py-3 border-b', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
        <h1 className={cn('text-lg font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>Link Pilot</h1>
        <p className={cn('text-xs mt-1', isLight ? 'text-gray-500' : 'text-gray-400')}>MVP 一键填表工作台</p>
      </div>

      {/* 标签栏 */}
      <div className={cn('flex-shrink-0 flex border-b', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
        {[
          { id: 'fill' as const, label: '填表' },
          { id: 'backlinks' as const, label: '外链' },
          { id: 'collection' as const, label: '采集' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium transition-colors relative',
              activeTab === tab.id
                ? isLight
                  ? 'text-blue-600'
                  : 'text-blue-400'
                : isLight
                  ? 'text-gray-600 hover:text-gray-900'
                  : 'text-gray-400 hover:text-gray-200',
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', isLight ? 'bg-blue-600' : 'bg-blue-400')} />
            )}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {(loadingPageState || sessionLoading) && activeTab === 'fill' && <LoadingSpinner />}
        {errorMessage && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200">{errorMessage}</div>}
        {message && <div className="rounded-lg p-3 text-sm bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200">{message}</div>}

        {/* 填表标签页 */}
        {activeTab === 'fill' && (
          <>
            {/* 当前页面 */}
            <section className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">当前页面</h2>
                <button onClick={() => void refreshPageState(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">重新检测</button>
              </div>
              {pageState ? (
                <div className="space-y-2 text-xs min-w-0">
                  <div className="break-words"><span className="text-gray-500">标题：</span>{pageState.seo?.title || '-'}</div>
                  <div className="break-words"><span className="text-gray-500">描述：</span>{pageState.seo?.description || '-'}</div>
                  <div className="break-words"><span className="text-gray-500">H1：</span>{pageState.seo?.h1 || '-'}</div>
                  <div><span className="text-gray-500">语言：</span>{pageState.seo?.language || '-'}</div>
                  <div className="break-all"><span className="text-gray-500">URL：</span>{pageState.seo?.url || '-'}</div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className={cn('px-2 py-0.5 rounded text-xs', pageState.form_detected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300')}>
                      表单 {pageState.form_detected ? '已检测' : '未检测到'}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded text-xs', pageState.backlink_in_current_group ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300')}>
                      当前 URL {pageState.backlink_in_current_group ? '在外链分组中' : '未在当前分组中'}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded text-xs', pageState.selected_website_link_present ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300')}>
                      所选网站链接 {pageState.selected_website_link_present ? '已存在' : '未发现'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">无法读取当前页面状态。</div>
              )}
            </section>

            {/* 我的网站 */}
            <section className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">我的网站</h2>
                <button onClick={() => chrome.runtime.openOptionsPage()} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">管理网站</button>
              </div>
              {enabledProfiles.length === 0 ? (
                <div className="text-sm text-gray-500">还没有启用中的网站资料，请先到管理页创建。</div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">分组</label>
                      <select
                        value={selectedGroupId}
                        onChange={async event => {
                          const nextGroupId = event.target.value;
                          setSelectedGroupId(nextGroupId);
                          const nextProfile = enabledProfiles.find(profile => profile.group_id === nextGroupId) ?? enabledProfiles[0];
                          if (nextProfile) {
                            setSelectedWebsiteId(nextProfile.id);
                            await updateSession({ selected_website_group_id: nextGroupId, selected_website_id: nextProfile.id });
                          }
                        }}
                        className={cn('w-full px-3 py-2 rounded border text-sm', isLight ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-700')}
                      >
                        {groups.map(group => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">网站</label>
                      <select
                        value={selectedWebsiteId}
                        onChange={async event => {
                          setSelectedWebsiteId(event.target.value);
                          await updateSession({ selected_website_id: event.target.value });
                        }}
                        className={cn('w-full px-3 py-2 rounded border text-sm', isLight ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-700')}
                      >
                        {groupProfiles.map(profile => (
                          <option key={profile.id} value={profile.id}>{profile.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {selectedProfile && (
                    <div className="text-xs space-y-1 p-3 rounded bg-gray-50 dark:bg-gray-800">
                      <div><span className="text-gray-500">URL：</span>{selectedProfile.url}</div>
                      <div><span className="text-gray-500">名称：</span>{selectedProfile.author_name}</div>
                      <div><span className="text-gray-500">邮箱：</span>{selectedProfile.author_email}</div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 当前外链记录 */}
            <section className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <h2 className="text-sm font-semibold mb-3">当前外链记录</h2>
              {currentBacklink ? (
                <div className="space-y-2 text-xs">
                  <div className="font-medium text-sm">{currentBacklink.domain}</div>
                  <div className="break-all">{currentBacklink.url}</div>
                  <div className="text-gray-500">队列进度：{Math.min(session.queue_cursor, session.queue_backlink_ids.length)}/{session.queue_backlink_ids.length}</div>
                  {currentBacklink.note && <div className="text-gray-500">备注：{currentBacklink.note}</div>}
                  <button onClick={openNextBacklinks} disabled={working || session.queue_backlink_ids.length === 0} className="w-full py-2 rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 text-sm">
                    下一个外链
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-gray-500">
                  <div>暂无当前外链记录。</div>
                  <button onClick={() => setActiveTab('backlinks')} className="w-full py-2 rounded bg-blue-500 text-white hover:bg-blue-600 text-sm">
                    现在去选择外链
                  </button>
                </div>
              )}
            </section>

            {/* 表单动作 */}
            <section className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">表单动作</h2>
                <div className="text-xs text-gray-500">只填表，不自动提交</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => void refreshPageState(true)} disabled={working} className="py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 text-sm">检测表单</button>
                <button onClick={locateNextForm} disabled={working} className="py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 text-sm">定位表单</button>
                <button onClick={performFill} disabled={working || !selectedProfile || !pageState?.form_detected} className="py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 text-sm">开始填表</button>
              </div>
              <div className="text-xs text-gray-500 mt-3">支持字段：{pageState?.field_types?.join('、') || '尚未检测'}。</div>
            </section>
          </>
        )}

        {/* 外链标签页 */}
        {activeTab === 'backlinks' && (
          <>
            <section className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">选择外链</h2>
                <button onClick={() => chrome.runtime.openOptionsPage()} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">完整管理页</button>
              </div>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={collectCurrentSite}
                  disabled={collectingCurrentSite || working}
                  className={cn(
                    'flex-1 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50',
                    isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600',
                  )}
                >
                  {collectingCurrentSite ? '采集中...' : '采集当前站点'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  value={backlinkSearch}
                  onChange={event => setBacklinkSearch(event.target.value)}
                  placeholder="搜索 URL"
                  className={cn('px-3 py-2 rounded border text-sm', isLight ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-700')}
                />
                <input
                  value={backlinkNote}
                  onChange={event => setBacklinkNote(event.target.value)}
                  placeholder="搜索备注"
                  className={cn('px-3 py-2 rounded border text-sm', isLight ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-700')}
                />
                <input
                  value={backlinkKeyword}
                  onChange={event => setBacklinkKeyword(event.target.value)}
                  placeholder="搜索关键词"
                  className={cn('px-3 py-2 rounded border text-sm', isLight ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-700')}
                />
                <select
                  value={selectedBacklinkGroupId}
                  onChange={async event => {
                    setSelectedBacklinkGroupId(event.target.value);
                    await updateSession({ selected_backlink_group_id: event.target.value === 'all' ? undefined : event.target.value });
                  }}
                  className={cn('px-3 py-2 rounded border text-sm', isLight ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-700')}
                >
                  <option value="all">所有分组</option>
                  {Array.from(new Set(backlinks.map(backlink => backlink.group_id))).map(groupId => (
                    <option key={groupId} value={groupId}>{groupId}</option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-gray-500">当前结果 {filteredBacklinks.length} 条；点击任意一条后会写入"当前外链记录"和队列。</div>
            </section>

            <section className={cn('p-3 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <div className="space-y-2 max-h-[calc(100vh-500px)] overflow-y-auto">
                {filteredBacklinks.length === 0 && <div className="text-sm text-gray-500 p-2">当前没有符合条件的外链。</div>}
                {filteredBacklinks.map(backlink => (
                  <div key={backlink.id} className={cn('p-3 rounded-lg border', isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-900/40')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{backlink.domain}</div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 break-all mt-1">{backlink.url}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {backlink.note || '无备注'}
                          {backlink.keywords.length > 0 ? ` · ${backlink.keywords.join(', ')}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => void openBacklinkFromPopup(backlink.id, backlink.group_id)}
                        disabled={working}
                        className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm flex-shrink-0"
                      >
                        打开
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* 采集标签页 */}
        {activeTab === 'collection' && (
          <ManualCollector isLight={isLight} />
        )}
      </div>
    </div>
  );
};
