import './Popup.css';
import { useEffect, useMemo, useState } from 'react';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import {
  exampleThemeStorage,
  managedBacklinkStorage,
  submissionSessionStorage,
  websiteProfileStorage,
} from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { MessageType } from '@extension/shared';
import type { FillPageState, ManagedBacklink, WebsiteProfile, WebsiteProfileGroup } from '@extension/shared';
import { useSubmissionSession } from './hooks/useSubmissionSession';
import { buildCommentCandidates } from './utils/comment-generator';
import { ManualCollector } from './components/ManualCollector';
import { DevTools } from './components/DevTools';

type PopupTab = 'fill' | 'backlinks' | 'collection' | 'devtools';

export interface PopupViewProps {
  layout?: 'popup' | 'side-panel';
}

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

export const PopupView = ({ layout = 'popup' }: PopupViewProps) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const { session, loading: sessionLoading, updateSession } = useSubmissionSession();
  const [activeTab, setActiveTab] = useState<PopupTab>('fill');
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
  }, [backlinks, backlinkKeyword, backlinkNote, backlinkSearch, selectedBacklinkGroupId]);

  useEffect(() => {
    const load = async () => {
      const [profilesData, groupsData, backlinksData] = await Promise.all([
        websiteProfileStorage.getEnabledProfiles(),
        websiteProfileStorage.getAllGroups(),
        managedBacklinkStorage.getAllBacklinks(),
      ]);
      setProfiles(profilesData);
      setGroups(groupsData);
      setBacklinks(backlinksData);
    };

    void load();
    const unsubscribers = [
      websiteProfileStorage.subscribe(() => void load()),
      managedBacklinkStorage.subscribe(() => void load()),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  useEffect(() => {
    if (session.selected_website_group_id) {
      setSelectedGroupId(session.selected_website_group_id);
    }
    if (session.selected_website_id) {
      setSelectedWebsiteId(session.selected_website_id);
    }
  }, [session.selected_website_group_id, session.selected_website_id]);

  useEffect(() => {
    if (!groups.length) return;
    if (!groups.some(group => group.id === selectedGroupId)) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    if (!selectedProfile && groupProfiles[0]) {
      setSelectedWebsiteId(groupProfiles[0].id);
      return;
    }
    if (selectedProfile && selectedWebsiteId !== selectedProfile.id) {
      setSelectedWebsiteId(selectedProfile.id);
    }
  }, [groupProfiles, selectedProfile, selectedWebsiteId]);

  useEffect(() => {
    if (!selectedProfile) return;
    setSelectedCommentIndex(0);
    void updateSession({
      selected_website_group_id: selectedProfile.group_id,
      selected_website_id: selectedProfile.id,
    });
  }, [selectedProfile?.group_id, selectedProfile?.id, updateSession]);

  useEffect(() => {
    if (!generatedComments.length) {
      if (selectedCommentIndex !== 0) {
        setSelectedCommentIndex(0);
      }
      return;
    }

    if (selectedCommentIndex >= generatedComments.length) {
      setSelectedCommentIndex(0);
    }
  }, [generatedComments.length, selectedCommentIndex]);

  const queryActiveTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('无法获取当前标签页');
    }
    return tab;
  };

  const ensureContentScript = async (tabId: number) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/all.iife.js'],
    });
  };

  const sendMessageToActiveTab = async (message: unknown) => {
    const tab = await queryActiveTab();

    try {
      return await chrome.tabs.sendMessage(tab.id!, message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('Receiving end does not exist')) {
        throw error;
      }

      await ensureContentScript(tab.id!);
      return chrome.tabs.sendMessage(tab.id!, message);
    }
  };

  const refreshPageState = async (forceDetect = false) => {
    setLoadingPageState(true);
    setErrorMessage(null);
    try {
      if (forceDetect) {
        await sendMessageToActiveTab({ type: MessageType.DETECT_PAGE_FORMS });
      }
      const response = await sendMessageToActiveTab({
        type: MessageType.GET_FILL_PAGE_STATE,
        payload: {
          selectedWebsiteId: selectedProfile?.id,
          selectedBacklinkGroupId: currentBacklinkGroup,
        },
      });
      if (!response?.success) {
        throw new Error(response?.error || '获取页面状态失败');
      }
      setPageState(response.data ?? null);
    } catch (error) {
      // 如果是连接错误，说明当前页面没有 content script，这是正常的
      if (error instanceof Error && error.message.includes('Receiving end does not exist')) {
        console.log('[Popup] 当前页面没有 content script，跳过');
        setPageState(null);
        setErrorMessage('');
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '页面通信失败');
      setPageState(null);
    } finally {
      setLoadingPageState(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'fill') {
      return;
    }

    void refreshPageState(false);
  }, [activeTab, selectedProfile?.id, currentBacklinkGroup]);

  const cycleWebsite = async () => {
    if (!groupProfiles.length || !selectedProfile) return;
    const currentIndex = groupProfiles.findIndex(profile => profile.id === selectedProfile.id);
    const nextProfile = groupProfiles[(currentIndex + 1) % groupProfiles.length];
    setSelectedWebsiteId(nextProfile.id);
    await updateSession({ selected_website_id: nextProfile.id, selected_website_group_id: nextProfile.group_id });
  };

  const cycleComment = () => {
    if (generatedComments.length === 0) return;
    setSelectedCommentIndex(current => (current + 1) % generatedComments.length);
  };

  const performFill = async () => {
    if (!selectedProfile) {
      setErrorMessage('请先选择网站资料');
      return;
    }

    const selectedComment = generatedComments[selectedCommentIndex]?.trim();
    if (!selectedComment) {
      setErrorMessage('当前没有可用的评论内容');
      return;
    }

    setWorking(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const response = await sendMessageToActiveTab({
        type: MessageType.FILL_SELECTED_WEBSITE,
        payload: {
          selectedWebsiteId: selectedProfile.id,
          commentIndex: selectedCommentIndex,
          comment: selectedComment,
        },
      });
      if (!response?.success) {
        throw new Error(response?.error || '填表失败');
      }
      if (typeof response?.data?.commentIndex === 'number') {
        setSelectedCommentIndex(response.data.commentIndex);
      }
      setMessage(`已填充字段：${(response?.data?.filledFields ?? []).join('、') || '无'}`);
      await refreshPageState(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '填表失败');
    } finally {
      setWorking(false);
    }
  };

  const locateNextForm = async () => {
    setWorking(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const response = await sendMessageToActiveTab({ type: MessageType.LOCATE_NEXT_FORM });
      if (!response?.success) {
        throw new Error(response?.error || '定位表单失败');
      }
      setMessage(`已定位表单 ${response.data.index}/${response.data.total}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '定位表单失败');
    } finally {
      setWorking(false);
    }
  };

  const openNextBacklinks = async () => {
    setWorking(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const response = await chrome.runtime.sendMessage({ type: MessageType.OPEN_NEXT_BACKLINKS });
      if (!response?.success) {
        throw new Error(response?.error || '打开下一个外链失败');
      }
      setMessage(`已打开 ${response.data.opened.length} 个外链，剩余 ${response.data.remaining} 个`);
      const nextSession = await submissionSessionStorage.getSession();
      await updateSession(nextSession);
      setActiveTab('fill');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '打开外链失败');
    } finally {
      setWorking(false);
    }
  };

  const openBacklinkFromPopup = async (backlinkId: string, groupId?: string) => {
    setWorking(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'OPEN_MANAGED_BACKLINK',
        payload: {
          backlinkId,
          queueIds: filteredBacklinks.map(backlink => backlink.id),
          groupId,
        },
      });
      if (!response?.success) {
        throw new Error(response?.error || '打开外链失败');
      }
      const nextSession = await submissionSessionStorage.getSession();
      await updateSession(nextSession);
      setMessage('已打开外链页面');
      setActiveTab('fill');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '打开外链失败');
    } finally {
      setWorking(false);
    }
  };

  const copyField = async (value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setMessage('已复制到剪贴板');
  };

  const collectCurrentSite = async () => {
    setCollectingCurrentSite(true);
    setMessage(null);
    setErrorMessage(null);

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

      const backlinksData = await managedBacklinkStorage.getAllBacklinks();
      setBacklinks(backlinksData);
      const collectedCount = Number(response.count || 0);
      const addedToLibrary = Number(response.addedToLibrary ?? 0);
      const skippedInLibrary = Number(response.skippedInLibrary ?? 0);
      setMessage(
        skippedInLibrary > 0
          ? `采集完成：共 ${collectedCount} 条，新增到外链库 ${addedToLibrary} 条，跳过重复 ${skippedInLibrary} 条`
          : `采集完成：共 ${collectedCount} 条，新增到外链库 ${addedToLibrary} 条`,
      );
      setActiveTab('backlinks');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '采集失败');
    } finally {
      setCollectingCurrentSite(false);
    }
  };

  const containerClassName = layout === 'popup' ? 'w-[460px] h-[680px]' : 'w-full h-full';

  const openSidePanel = async () => {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // 打开侧边栏
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch (error) {
      console.error('打开侧边栏失败:', error);
    }
  };

  return (
    <div className={cn(containerClassName, 'flex flex-col overflow-hidden', isLight ? 'bg-slate-50' : 'bg-gray-900')}>
      <div className={cn('flex-shrink-0 px-4 py-3 border-b', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={cn('text-lg font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>Link Pilot</h1>
            <p className={cn('text-xs mt-1', isLight ? 'text-gray-500' : 'text-gray-400')}>MVP 一键填表工作台</p>
          </div>
          {layout === 'popup' && (
            <button
              onClick={openSidePanel}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                isLight
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              )}
            >
              打开侧边栏
            </button>
          )}
        </div>
      </div>

      <div className={cn('flex-shrink-0 flex border-b', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
        {[
          { id: 'fill' as const, label: '填表' },
          { id: 'backlinks' as const, label: '外链' },
          { id: 'collection' as const, label: '采集' },
          { id: 'devtools' as const, label: '🛠️' },
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {(loadingPageState || sessionLoading) && activeTab === 'fill' && <LoadingSpinner />}
        {errorMessage && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200">{errorMessage}</div>}
        {message && <div className="rounded-lg p-3 text-sm bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200">{message}</div>}

        {activeTab === 'fill' && (
          <>
            <section className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">当前页面</h2>
                <button onClick={() => void refreshPageState(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">重新检测</button>
              </div>
              {pageState ? (
                <div className="space-y-2 text-xs min-w-0">
                  <div className="break-words"><span className="text-gray-500">标题：</span>{pageState.seo.title || '-'}</div>
                  <div className="break-words"><span className="text-gray-500">描述：</span>{pageState.seo.description || '-'}</div>
                  <div className="break-words"><span className="text-gray-500">H1：</span>{pageState.seo.h1 || '-'}</div>
                  <div><span className="text-gray-500">语言：</span>{pageState.seo.language || '-'}</div>
                  <div className="break-all"><span className="text-gray-500">URL：</span>{pageState.seo.url}</div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className={cn('px-2 py-0.5 rounded', pageState.form_detected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300')}>
                      表单 {pageState.form_detected ? '已检测' : '未检测到'}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded', pageState.backlink_in_current_group ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300')}>
                      当前 URL {pageState.backlink_in_current_group ? '在外链分组中' : '未在当前分组中'}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded', pageState.selected_website_link_present ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300')}>
                      所选网站链接 {pageState.selected_website_link_present ? '已存在' : '未发现'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">无法读取当前页面状态。</div>
              )}
            </section>

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
                        value={selectedProfile?.id ?? ''}
                        onChange={async event => {
                          setSelectedWebsiteId(event.target.value);
                          const profile = enabledProfiles.find(item => item.id === event.target.value);
                          if (profile) {
                            await updateSession({ selected_website_id: profile.id, selected_website_group_id: profile.group_id });
                          }
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
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2"><span>{selectedProfile.name}</span><button onClick={() => void cycleWebsite()} className="text-blue-600 dark:text-blue-400 hover:underline">下一个网站</button></div>
                      <div className="flex items-center justify-between gap-2"><span className="truncate">{selectedProfile.url}</span><button onClick={() => void copyField(selectedProfile.url)} className="text-blue-600 dark:text-blue-400 hover:underline">复制</button></div>
                      <div className="flex items-center justify-between gap-2"><span className="truncate">{selectedProfile.email}</span><button onClick={() => void copyField(selectedProfile.email)} className="text-blue-600 dark:text-blue-400 hover:underline">复制</button></div>
                      <div className="rounded-md p-2 bg-gray-50 dark:bg-gray-900/60">
                        <div className="flex items-center justify-between mb-1 gap-2"><span>评论 {generatedComments.length === 0 ? 0 : selectedCommentIndex + 1}/{generatedComments.length}</span><button onClick={cycleComment} className="text-blue-600 dark:text-blue-400 hover:underline">下一个评论</button></div>
                        <div className="text-[11px] text-gray-500 mb-2">已结合当前页面标题、H1、描述和 URL 自动生成评论候选。</div>
                        <div className="max-h-28 overflow-y-auto pr-1 leading-5 break-words">{generatedComments[selectedCommentIndex] || '暂无可用评论，请先补充网站资料或重新检测页面。'}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">当前外链记录</h2>
                <button onClick={() => setActiveTab('backlinks')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">去选外链</button>
              </div>
              {currentBacklink ? (
                <div className="space-y-2 text-xs">
                  <div className="font-medium text-sm">{currentBacklink.domain}</div>
                  <div className="break-all">{currentBacklink.url}</div>
                  <div className="text-gray-500">队列进度：{Math.min(session.queue_cursor, session.queue_backlink_ids.length)}/{session.queue_backlink_ids.length}</div>
                  {currentBacklink.note && <div className="text-gray-500">备注：{currentBacklink.note}</div>}
                  <button onClick={openNextBacklinks} disabled={working || session.queue_backlink_ids.length === 0} className="w-full py-2 rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50">
                    下一个外链
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-gray-500">
                  <div>暂无当前外链记录。</div>
                  <button onClick={() => setActiveTab('backlinks')} className="w-full py-2 rounded bg-blue-500 text-white hover:bg-blue-600">
                    现在去选择外链
                  </button>
                </div>
              )}
            </section>

            <section className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">表单动作</h2>
                <div className="text-xs text-gray-500">只填表，不自动提交</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => void refreshPageState(true)} disabled={working} className="py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-50">检测表单</button>
                <button onClick={locateNextForm} disabled={working} className="py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-50">定位表单</button>
                <button onClick={performFill} disabled={working || !selectedProfile || !pageState?.form_detected} className="py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">开始填表</button>
              </div>
              <div className="text-xs text-gray-500 mt-3">支持字段：{pageState?.field_types?.join('、') || '尚未检测'}。</div>
            </section>
          </>
        )}

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
              <div className="text-xs text-gray-500">当前结果 {filteredBacklinks.length} 条；点击任意一条后会写入“当前外链记录”和队列。</div>
            </section>

            <section className={cn('p-3 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
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

        {activeTab === 'collection' && (
          <ManualCollector isLight={isLight} />
        )}

        {activeTab === 'devtools' && (
          <DevTools />
        )}
      </div>
    </div>
  );
};

const Popup = () => <PopupView layout="popup" />;

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
