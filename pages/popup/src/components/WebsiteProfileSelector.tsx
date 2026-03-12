import { useEffect, useMemo, useState } from 'react';
import { websiteProfileStorage, managedBacklinkStorage } from '@extension/storage';
import type { WebsiteProfile, ManagedBacklink, FillPageState } from '@extension/shared';
import { buildCommentCandidates } from '../utils/comment-generator';
import { cn } from '@extension/ui';
import { exampleThemeStorage } from '@extension/storage';
import { useStorage } from '@extension/shared';

export interface WebsiteProfileSelectorProps {
  backlinkIds: string[];
  onConfirm: (websiteProfileId: string) => void;
  onCancel: () => void;
}

export function WebsiteProfileSelector({ backlinkIds, onConfirm, onCancel }: WebsiteProfileSelectorProps) {
  const { isLight } = useStorage(exampleThemeStorage);

  const [profiles, setProfiles] = useState<WebsiteProfile[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('default');
  const [backlinks, setBacklinks] = useState<ManagedBacklink[]>([]);
  const [pageState, setPageState] = useState<FillPageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(0);

  // 加载网站资料列表和外链信息
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [profilesData, groupsData, allBacklinks] = await Promise.all([
          websiteProfileStorage.getEnabledProfiles(),
          websiteProfileStorage.getAllGroups(),
          managedBacklinkStorage.getAllBacklinks(),
        ]);

        setProfiles(profilesData);
        setGroups(groupsData);

        // 过滤出选中的外链
        const selectedBacklinks = allBacklinks.filter(backlink => backlinkIds.includes(backlink.id));
        setBacklinks(selectedBacklinks);

        // 设置默认选中的网站资料
        if (profilesData.length > 0) {
          const firstGroupId = profilesData[0]?.group_id ?? 'default';
          setSelectedGroupId(firstGroupId);
          const groupProfiles = profilesData.filter(p => p.group_id === firstGroupId);
          if (groupProfiles.length > 0) {
            setSelectedProfileId(groupProfiles[0].id);
          } else {
            setSelectedProfileId(profilesData[0].id);
          }
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [backlinkIds]);

  // 尝试获取当前页面状态
  useEffect(() => {
    const fetchPageState = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'GET_FILL_PAGE_STATE',
          });
          if (response?.success && response.data) {
            setPageState(response.data);
          }
        }
      } catch {
        // 如果无法获取页面状态，使用默认逻辑
        setPageState(null);
      }
    };

    void fetchPageState();
  }, []);

  // 获取当前分组下的网站资料
  const groupProfiles = useMemo(() => {
    return profiles.filter(profile => profile.group_id === selectedGroupId);
  }, [profiles, selectedGroupId]);

  // 获取选中的网站资料
  const selectedProfile = useMemo(() => {
    return profiles.find(profile => profile.id === selectedProfileId) ?? null;
  }, [profiles, selectedProfileId]);

  // 获取第一个外链用于生成评论（如果有多个外链，使用第一个）
  const currentBacklink = useMemo(() => {
    return backlinks[0] ?? null;
  }, [backlinks]);

  // 生成评论预览
  const generatedComments = useMemo(() => {
    if (!selectedProfile) return [];
    return buildCommentCandidates(selectedProfile, pageState, currentBacklink);
  }, [selectedProfile, pageState, currentBacklink]);

  // 当前选中的评论
  const selectedComment = useMemo(() => {
    if (generatedComments.length === 0) return '';
    return generatedComments[selectedCommentIndex] ?? generatedComments[0] ?? '';
  }, [generatedComments, selectedCommentIndex]);

  // 切换评论
  const cycleComment = () => {
    if (generatedComments.length === 0) return;
    setSelectedCommentIndex(prev => (prev + 1) % generatedComments.length);
  };

  // 处理确认
  const handleConfirm = () => {
    if (selectedProfileId) {
      onConfirm(selectedProfileId);
    }
  };

  // 处理分组变更
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const groupProfilesList = profiles.filter(p => p.group_id === groupId);
    if (groupProfilesList.length > 0) {
      setSelectedProfileId(groupProfilesList[0].id);
    }
  };

  if (loading) {
    return (
      <div className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
        <div className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>加载中...</div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className={cn('p-4 rounded-lg border', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
        <div className={cn('text-sm mb-4', isLight ? 'text-gray-600' : 'text-gray-400')}>
          没有可用的网站资料，请先创建网站资料。
        </div>
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className={cn(
              'px-4 py-2 rounded text-sm font-medium',
              isLight ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600',
            )}>
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 rounded-lg border space-y-4', isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700')}>
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h2 className={cn('text-base font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>选择网站资料</h2>
        <span className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>
          共 {backlinkIds.length} 个外链待提交
        </span>
      </div>

      {/* 分组选择 */}
      <div>
        <label className={cn('block text-xs mb-1.5', isLight ? 'text-gray-500' : 'text-gray-400')}>分组</label>
        <select
          value={selectedGroupId}
          onChange={e => handleGroupChange(e.target.value)}
          className={cn(
            'w-full px-3 py-2 rounded border text-sm',
            isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100',
          )}>
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      {/* 网站资料选择 */}
      <div>
        <label className={cn('block text-xs mb-1.5', isLight ? 'text-gray-500' : 'text-gray-400')}>网站</label>
        <select
          value={selectedProfileId}
          onChange={e => setSelectedProfileId(e.target.value)}
          className={cn(
            'w-full px-3 py-2 rounded border text-sm',
            isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100',
          )}>
          {groupProfiles.map(profile => (
            <option key={profile.id} value={profile.id}>
              {profile.name} ({profile.domain})
            </option>
          ))}
        </select>
      </div>

      {/* 选中的网站资料信息 */}
      {selectedProfile && (
        <div className={cn('p-3 rounded-md text-xs space-y-1.5', isLight ? 'bg-gray-50' : 'bg-gray-900/60')}>
          <div className={cn(isLight ? 'text-gray-700' : 'text-gray-300')}>
            <span className={cn('text-gray-500', isLight ? 'text-gray-500' : 'text-gray-400')}>名称: </span>
            {selectedProfile.name}
          </div>
          <div className={cn(isLight ? 'text-gray-700' : 'text-gray-300')}>
            <span className={cn('text-gray-500', isLight ? 'text-gray-500' : 'text-gray-400')}>URL: </span>
            <span className="break-all">{selectedProfile.url}</span>
          </div>
          <div className={cn(isLight ? 'text-gray-700' : 'text-gray-300')}>
            <span className={cn('text-gray-500', isLight ? 'text-gray-500' : 'text-gray-400')}>邮箱: </span>
            {selectedProfile.email}
          </div>
        </div>
      )}

      {/* 评论预览 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>评论预览</label>
          {generatedComments.length > 1 && (
            <button
              onClick={cycleComment}
              className={cn('text-xs hover:underline', isLight ? 'text-blue-600' : 'text-blue-400')}>
              切换评论 ({selectedCommentIndex + 1}/{generatedComments.length})
            </button>
          )}
        </div>
        <div
          className={cn(
            'p-3 rounded-md text-sm leading-relaxed min-h-[80px] max-h-40 overflow-y-auto break-words',
            isLight ? 'bg-gray-50 text-gray-700' : 'bg-gray-900/60 text-gray-300',
          )}>
          {selectedComment || (
            <span className={isLight ? 'text-gray-400' : 'text-gray-500'}>暂无可用评论，请先补充网站资料</span>
          )}
        </div>
        <div className={cn('text-xs mt-1', isLight ? 'text-gray-400' : 'text-gray-500')}>
          已结合外链信息和网站资料自动生成评论候选
        </div>
      </div>

      {/* 外链信息摘要 */}
      {backlinks.length > 0 && (
        <div className={cn('p-3 rounded-md', isLight ? 'bg-blue-50' : 'bg-blue-900/20')}>
          <div className={cn('text-xs font-medium mb-1', isLight ? 'text-blue-700' : 'text-blue-300')}>
            待提交外链
          </div>
          <div className={cn('text-xs', isLight ? 'text-blue-600' : 'text-blue-400')}>
            {backlinks.slice(0, 3).map(backlink => (
              <div key={backlink.id} className="truncate">{backlink.domain}</div>
            ))}
            {backlinks.length > 3 && (
              <div className={cn('text-xs mt-1', isLight ? 'text-blue-500' : 'text-blue-300')}>
                还有 {backlinks.length - 3} 个外链...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 按钮组 */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className={cn(
            'flex-1 px-4 py-2.5 rounded text-sm font-medium transition-colors',
            isLight
              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600',
          )}>
          取消
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedProfileId}
          className={cn(
            'flex-1 px-4 py-2.5 rounded text-sm font-medium transition-colors disabled:opacity-50',
            isLight
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-blue-500 text-white hover:bg-blue-600',
          )}>
          确认并加入队列
        </button>
      </div>
    </div>
  );
}
