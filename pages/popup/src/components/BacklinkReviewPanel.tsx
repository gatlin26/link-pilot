import { useState, useEffect, useMemo } from 'react';
import { cn } from '@extension/ui';
import { opportunityStorage, managedBacklinkStorage } from '@extension/storage';
import { OpportunityStatus } from '@extension/shared';
import type { Opportunity, ManagedBacklinkGroup } from '@extension/shared';

interface BacklinkReviewPanelProps {
  isLight: boolean;
  onOpportunitiesChanged?: () => void;
}

type SubmissionMode = 'per_url' | 'per_domain';
type FilterStatus = 'all' | 'new' | 'converted' | 'discarded';

interface DomainConfig {
  submissionMode: SubmissionMode;
  submitPageUrl: string;
  targetGroupId: string;
  selectedOpportunityIds: Set<string>;
}

export const BacklinkReviewPanel = ({ isLight, onOpportunitiesChanged }: BacklinkReviewPanelProps) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [groups, setGroups] = useState<ManagedBacklinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [domainConfigs, setDomainConfigs] = useState<Record<string, DomainConfig>>({});
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('new');
  const [convertingDomains, setConvertingDomains] = useState<Set<string>>(new Set());
  const [discardingIds, setDiscardingIds] = useState<Set<string>>(new Set());

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true);
      const [oppData, groupData] = await Promise.all([
        opportunityStorage.getAll(),
        managedBacklinkStorage.getAllGroups(),
      ]);
      setOpportunities(oppData);
      setGroups(groupData);
    } catch (err) {
      console.error('加载审核数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 按域名分组的机会（根据筛选状态过滤）
  const groupedOpportunities = useMemo(() => {
    const filtered = filterStatus === 'all'
      ? opportunities
      : opportunities.filter(o => o.status === filterStatus);

    return filtered.reduce((acc, opp) => {
      const domain = opp.domain.toLowerCase();
      if (!acc[domain]) {
        acc[domain] = [];
      }
      acc[domain].push(opp);
      return acc;
    }, {} as Record<string, Opportunity[]>);
  }, [opportunities, filterStatus]);

  // 域名列表（按机会数量排序）
  const sortedDomains = useMemo(() => {
    return Object.keys(groupedOpportunities).sort((a, b) =>
      groupedOpportunities[b].length - groupedOpportunities[a].length
    );
  }, [groupedOpportunities]);

  // 统计数量
  const stats = useMemo(() => ({
    new: opportunities.filter(o => o.status === 'new').length,
    converted: opportunities.filter(o => o.status === 'converted').length,
    discarded: opportunities.filter(o => o.status === 'discarded').length,
    total: opportunities.length,
  }), [opportunities]);

  // 切换域名展开状态
  const toggleDomainExpand = (domain: string) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domain)) {
        newSet.delete(domain);
      } else {
        newSet.add(domain);
      }
      return newSet;
    });
  };

  // 获取域名配置（带默认值）
  const getDomainConfig = (domain: string): DomainConfig => {
    return domainConfigs[domain] || {
      submissionMode: 'per_url',
      submitPageUrl: '',
      targetGroupId: groups[0]?.id || 'default',
      selectedOpportunityIds: new Set(),
    };
  };

  // 更新域名配置
  const updateDomainConfig = (domain: string, updates: Partial<DomainConfig>) => {
    setDomainConfigs(prev => ({
      ...prev,
      [domain]: { ...getDomainConfig(domain), ...updates },
    }));
  };

  // 切换机会选中状态
  const toggleOpportunitySelection = (domain: string, oppId: string) => {
    const config = getDomainConfig(domain);
    const newSelected = new Set(config.selectedOpportunityIds);
    if (newSelected.has(oppId)) {
      newSelected.delete(oppId);
    } else {
      newSelected.add(oppId);
    }
    updateDomainConfig(domain, { selectedOpportunityIds: newSelected });
  };

  // 全选/取消全选
  const toggleSelectAll = (domain: string) => {
    const domainOpps = groupedOpportunities[domain];
    const config = getDomainConfig(domain);
    const allSelected = domainOpps.every(opp => config.selectedOpportunityIds.has(opp.id));

    if (allSelected) {
      updateDomainConfig(domain, { selectedOpportunityIds: new Set() });
    } else {
      updateDomainConfig(domain, { selectedOpportunityIds: new Set(domainOpps.map(o => o.id)) });
    }
  };

  // 转化单个域名
  const handleConvertDomain = async (domain: string) => {
    const config = getDomainConfig(domain);
    const domainOpps = groupedOpportunities[domain];

    if (domainOpps.length === 0) return;

    try {
      setConvertingDomains(prev => new Set(prev).add(domain));

      if (config.submissionMode === 'per_domain') {
        // per_domain 模式：创建一条外链记录
        const submitUrl = config.submitPageUrl || `https://${domain}`;

        // 检查是否已存在
        const existing = await managedBacklinkStorage.getByDomain(domain);
        if (existing.length > 0) {
          alert(`域名 ${domain} 已存在外链记录`);
          return;
        }

        // 创建外链记录
        const backlink = {
          id: crypto.randomUUID(),
          group_id: config.targetGroupId,
          url: submitUrl,
          domain: domain,
          note: `来自 ${domainOpps.length} 个机会页面的聚合`,
          keywords: Array.from(new Set(domainOpps.map(o => o.link_type))),
          flagged: false,
          submission_mode: 'per_domain' as const,
          submit_page_url: submitUrl,
          source_opportunity_ids: domainOpps.map(o => o.id),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await managedBacklinkStorage.addBacklink(backlink);

        // 标记所有未审核机会为已转化
        for (const opp of domainOpps.filter(o => o.status === OpportunityStatus.NEW)) {
          await opportunityStorage.markAsConverted(opp.id, backlink.id);
        }
      } else {
        // per_url 模式：为每个选中的未审核机会创建外链记录
        const selectedIds = config.selectedOpportunityIds;
        const oppsToConvert = selectedIds.size > 0
          ? domainOpps.filter(o => selectedIds.has(o.id) && o.status === OpportunityStatus.NEW)
          : domainOpps.filter(o => o.status === OpportunityStatus.NEW);

        for (const opp of oppsToConvert) {
          // 检查是否已存在
          const allBacklinks = await managedBacklinkStorage.getAllBacklinks();
          const exists = allBacklinks.some(b =>
            b.url.toLowerCase() === opp.url.toLowerCase() &&
            b.group_id === config.targetGroupId
          );

          if (exists) continue;

          const backlink = {
            id: crypto.randomUUID(),
            group_id: config.targetGroupId,
            url: opp.url,
            domain: opp.domain,
            note: opp.site_summary,
            keywords: [opp.link_type],
            flagged: false,
            submission_mode: 'per_url' as const,
            source_opportunity_id: opp.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await managedBacklinkStorage.addBacklink(backlink);
          await opportunityStorage.markAsConverted(opp.id, backlink.id);
        }
      }

      // 刷新数据
      await loadData();
      onOpportunitiesChanged?.();

      // 清除该域名的配置
      setDomainConfigs(prev => {
        const newConfigs = { ...prev };
        delete newConfigs[domain];
        return newConfigs;
      });
    } catch (err) {
      console.error('转化失败:', err);
      alert('转化失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setConvertingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domain);
        return newSet;
      });
    }
  };

  // 丢弃单个机会
  const handleDiscardOpportunity = async (oppId: string, reason?: string) => {
    try {
      setDiscardingIds(prev => new Set(prev).add(oppId));
      await opportunityStorage.markAsDiscarded(oppId, reason);
      await loadData();
      onOpportunitiesChanged?.();
    } catch (err) {
      console.error('丢弃失败:', err);
    } finally {
      setDiscardingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(oppId);
        return newSet;
      });
    }
  };

  // 预览URL
  const handlePreview = (url: string) => {
    chrome.tabs.create({ url, active: false });
  };

  // 获取链接类型的中文显示
  const getLinkTypeLabel = (linkType: string): string => {
    const typeMap: Record<string, string> = {
      'blog_comment': '博客评论',
      'guest_post': '客座文章',
      'forum': '论坛',
      'directory': '目录',
      'resource_page': '资源页',
      'unknown': '未知',
    };
    return typeMap[linkType] || linkType;
  };

  // 获取状态标签
  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      'new': '未审核',
      'converted': '已转化',
      'discarded': '已丢弃',
      'submitted': '已提交',
      'ready_to_submit': '准备提交',
      'rejected': '已拒绝',
      'archived': '已归档',
    };
    return statusMap[status] || status;
  };

  // 获取状态颜色
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'new': return isLight ? 'text-gray-600' : 'text-gray-400';
      case 'converted': return 'text-green-600 dark:text-green-400';
      case 'discarded': return 'text-red-600 dark:text-red-400';
      case 'submitted': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className={cn(
        'rounded-lg border p-4',
        isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <div className="text-center py-4 text-sm text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-lg border',
      isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
    )}>
      {/* 头部 */}
      <div className={cn(
        'px-4 py-3 border-b flex items-center justify-between',
        isLight ? 'border-gray-200' : 'border-gray-700'
      )}>
        <h3 className={cn('text-sm font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
          外链审核
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className={cn(
              'text-xs rounded px-2 py-1 border',
              isLight
                ? 'bg-white border-gray-300 text-gray-700'
                : 'bg-gray-700 border-gray-600 text-gray-200'
            )}
          >
            <option value="all">全部 ({stats.total})</option>
            <option value="new">未审核 ({stats.new})</option>
            <option value="converted">已转化 ({stats.converted})</option>
            <option value="discarded">已丢弃 ({stats.discarded})</option>
          </select>
          <button
            onClick={loadData}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            刷新
          </button>
        </div>
      </div>

      {/* 域名列表 */}
      <div className="max-h-96 overflow-y-auto">
        {sortedDomains.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            暂无{filterStatus === 'new' ? '待审核' : ''}数据
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedDomains.map(domain => {
              const domainOpps = groupedOpportunities[domain];
              const isExpanded = expandedDomains.has(domain);
              const config = getDomainConfig(domain);
              const isConverting = convertingDomains.has(domain);
              const newCount = domainOpps.filter(o => o.status === 'new').length;
              const convertedCount = domainOpps.filter(o => o.status === 'converted').length;

              // 获取该域名下的链接类型
              const linkTypes = Array.from(new Set(domainOpps.map(o => o.link_type)));

              return (
                <div key={domain} className={isLight ? 'bg-gray-50' : 'bg-gray-900/40'}>
                  {/* 域名标题行 */}
                  <button
                    onClick={() => toggleDomainExpand(domain)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm font-medium truncate',
                          isLight ? 'text-gray-900' : 'text-gray-100'
                        )}>
                          {domain}
                        </span>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          isLight ? 'bg-gray-200 text-gray-600' : 'bg-gray-700 text-gray-400'
                        )}>
                          {domainOpps.length}
                        </span>
                        {linkTypes.length > 0 && (
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-900/30 text-blue-400'
                          )}>
                            {linkTypes.slice(0, 2).map(t => getLinkTypeLabel(t)).join(', ')}
                            {linkTypes.length > 2 && '...'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {newCount > 0 && (
                          <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>
                            未审核 {newCount}
                          </span>
                        )}
                        {convertedCount > 0 && (
                          <span className="text-green-600 dark:text-green-400">
                            已转化 {convertedCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
                      className={cn(
                        'w-4 h-4 transition-transform',
                        isExpanded ? 'rotate-180' : '',
                        isLight ? 'text-gray-400' : 'text-gray-500'
                      )}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 展开的详细内容 */}
                  {isExpanded && (
                    <div className={cn(
                      'px-4 py-3 border-t',
                      isLight ? 'border-gray-200 bg-white' : 'border-gray-700 bg-gray-800/50'
                    )}>
                      {/* 提交模式配置 */}
                      {newCount > 0 && (
                        <div className="mb-4 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                          <div className="space-y-3">
                            {/* 提交模式选择 */}
                            <div className="flex items-center gap-3">
                              <label className={cn(
                                'text-xs font-medium',
                                isLight ? 'text-gray-700' : 'text-gray-300'
                              )}>
                                提交模式:
                              </label>
                              <select
                                value={config.submissionMode}
                                onChange={(e) => updateDomainConfig(domain, { submissionMode: e.target.value as SubmissionMode })}
                                className={cn(
                                  'text-xs rounded px-2 py-1 border',
                                  isLight
                                    ? 'bg-white border-gray-300 text-gray-700'
                                    : 'bg-gray-700 border-gray-600 text-gray-200'
                                )}
                              >
                                <option value="per_url">每篇文章独立提交</option>
                                <option value="per_domain">整个域名一个入口</option>
                              </select>
                            </div>

                            {/* per_domain 模式下的提交页面 */}
                            {config.submissionMode === 'per_domain' && (
                              <div className="flex items-center gap-2">
                                <label className={cn(
                                  'text-xs',
                                  isLight ? 'text-gray-600' : 'text-gray-400'
                                )}>
                                  提交页面:
                                </label>
                                <input
                                  type="text"
                                  value={config.submitPageUrl}
                                  onChange={(e) => updateDomainConfig(domain, { submitPageUrl: e.target.value })}
                                  placeholder={`https://${domain}/submit`}
                                  className={cn(
                                    'flex-1 text-xs px-2 py-1 rounded border',
                                    isLight
                                      ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                      : 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500'
                                  )}
                                />
                              </div>
                            )}

                            {/* 目标分组选择 */}
                            <div className="flex items-center gap-2">
                              <label className={cn(
                                'text-xs',
                                isLight ? 'text-gray-600' : 'text-gray-400'
                              )}>
                                目标分组:
                              </label>
                              <select
                                value={config.targetGroupId}
                                onChange={(e) => updateDomainConfig(domain, { targetGroupId: e.target.value })}
                                className={cn(
                                  'flex-1 text-xs rounded px-2 py-1 border',
                                  isLight
                                    ? 'bg-white border-gray-300 text-gray-700'
                                    : 'bg-gray-700 border-gray-600 text-gray-200'
                                )}
                              >
                                {groups.map(group => (
                                  <option key={group.id} value={group.id}>{group.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* 转化按钮 */}
                            <button
                              onClick={() => handleConvertDomain(domain)}
                              disabled={isConverting}
                              className={cn(
                                'w-full px-3 py-2 rounded text-xs font-medium transition-colors',
                                isConverting
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : isLight
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                              )}
                            >
                              {isConverting ? '转化中...' : `转化到外链库 (${config.submissionMode === 'per_url' ? (config.selectedOpportunityIds.size || domainOpps.filter(o => o.status === 'new').length) : domainOpps.filter(o => o.status === 'new').length} 条)`}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* URL 列表 */}
                      <div className="space-y-2">
                        {config.submissionMode === 'per_url' && newCount > 0 && (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={domainOpps.filter(o => o.status === 'new').every(o => config.selectedOpportunityIds.has(o.id))}
                              onChange={() => toggleSelectAll(domain)}
                              className="rounded border-gray-300"
                            />
                            <span className={cn(
                              'text-xs',
                              isLight ? 'text-gray-600' : 'text-gray-400'
                            )}>
                              全选
                            </span>
                            {config.selectedOpportunityIds.size > 0 && (
                              <span className="text-xs text-blue-600 dark:text-blue-400">
                                已选 {config.selectedOpportunityIds.size} 个
                              </span>
                            )}
                          </div>
                        )}

                        {domainOpps.map(opp => (
                          <div
                            key={opp.id}
                            className={cn(
                              'flex items-start gap-2 py-2 px-2 rounded',
                              isLight ? 'hover:bg-gray-50' : 'hover:bg-gray-800/50'
                            )}
                          >
                            {/* 复选框（仅未审核状态且 per_url 模式显示） */}
                            {config.submissionMode === 'per_url' && opp.status === 'new' && (
                              <input
                                type="checkbox"
                                checked={config.selectedOpportunityIds.has(opp.id)}
                                onChange={() => toggleOpportunitySelection(domain, opp.id)}
                                className="mt-0.5 rounded border-gray-300"
                              />
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handlePreview(opp.url)}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all text-left"
                                >
                                  {opp.url.length > 50 ? opp.url.slice(0, 50) + '...' : opp.url}
                                </button>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs">
                                <span className={cn(
                                  'px-1.5 py-0.5 rounded',
                                  opp.link_type === 'blog_comment' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                  opp.link_type === 'guest_post' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                  opp.link_type === 'forum' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                  opp.link_type === 'directory' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                )}>
                                  {getLinkTypeLabel(opp.link_type)}
                                </span>
                                <span className={getStatusColor(opp.status)}>
                                  {getStatusLabel(opp.status)}
                                </span>
                                <span className={isLight ? 'text-gray-400' : 'text-gray-500'}>
                                  {new Date(opp.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {opp.site_summary && (
                                <p className={cn(
                                  'text-xs mt-1 line-clamp-2',
                                  isLight ? 'text-gray-500' : 'text-gray-400'
                                )}>
                                  {opp.site_summary}
                                </p>
                              )}
                            </div>

                            {/* 操作按钮 */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handlePreview(opp.url)}
                                className={cn(
                                  'px-2 py-1 rounded text-xs',
                                  isLight
                                    ? 'text-gray-600 hover:bg-gray-100'
                                    : 'text-gray-400 hover:bg-gray-700'
                                )}
                                title="预览"
                              >
                                预览
                              </button>
                              {opp.status === 'new' && (
                                <button
                                  onClick={() => handleDiscardOpportunity(opp.id)}
                                  disabled={discardingIds.has(opp.id)}
                                  className={cn(
                                    'px-2 py-1 rounded text-xs',
                                    discardingIds.has(opp.id)
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                  )}
                                >
                                  {discardingIds.has(opp.id) ? '...' : '丢弃'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
