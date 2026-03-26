/**
 * 外链卡片组件
 * 展示：网站名称、URL、站点类型、可用性状态、分类、语言、DR/AS、AI 摘要、操作按钮
 */

import { LinkAvailabilityStatus, LinkSiteType } from '@extension/shared';
import type { ExternalLink, ExternalLinkMetadata } from '@extension/shared';

interface LinkCardProps {
  link: ExternalLink;
  metadata?: ExternalLinkMetadata | null;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onCheckAvailability: (id: string) => void;
  onReanalyze: () => void;
}

const statusColors = {
  [LinkAvailabilityStatus.UNKNOWN]: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  [LinkAvailabilityStatus.CHECKING]: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  [LinkAvailabilityStatus.AVAILABLE]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  [LinkAvailabilityStatus.UNAVAILABLE]: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const statusLabels = {
  [LinkAvailabilityStatus.UNKNOWN]: '未知',
  [LinkAvailabilityStatus.CHECKING]: '检测中',
  [LinkAvailabilityStatus.AVAILABLE]: '可用',
  [LinkAvailabilityStatus.UNAVAILABLE]: '不可用',
};

const siteTypeLabels: Record<string, string> = {
  [LinkSiteType.BLOG_COMMENT]: 'Blog评论',
  [LinkSiteType.DIRECTORY]: '目录站',
  [LinkSiteType.AI_DIRECTORY]: 'AI导航',
  [LinkSiteType.FORUM]: '论坛',
  [LinkSiteType.SOCIAL_PROFILE]: '社交资料',
  [LinkSiteType.GUEST_POST]: '客座文章',
  [LinkSiteType.TOOL_SUBMISSION]: '工具站',
  [LinkSiteType.OTHER]: '其他',
};

const LinkCard = (props: LinkCardProps) => {
  const { link, metadata, onOpen, onEdit, onDelete, onFavorite, onCheckAvailability, onReanalyze } = props;
  const statusColor = statusColors[link.status];
  const statusLabel = statusLabels[link.status];
  const siteType = metadata?.detectedSiteType || link.siteType;

  return (
    <div className="rounded-xl border bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{metadata?.siteName || link.domain}</h3>
            {link.favorite && <span className="text-sm text-yellow-500">★</span>}
          </div>
          <div className="mt-0.5 truncate text-xs text-blue-500">{link.url}</div>
        </div>
        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Tags */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
          {siteTypeLabels[siteType] || siteType}
        </span>
        {metadata?.language && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {metadata.language}
          </span>
        )}
        {metadata?.dr !== undefined && (
          <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-600 dark:bg-green-900/30 dark:text-green-300">
            DR {metadata.dr}
          </span>
        )}
        {metadata?.as !== undefined && (
          <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-600 dark:bg-green-900/30 dark:text-green-300">
            AS {metadata.as}
          </span>
        )}
      </div>

      {/* Summary */}
      {metadata?.summary && <p className="mb-3 line-clamp-2 text-xs text-gray-500">{metadata.summary}</p>}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t pt-2 dark:border-gray-700">
        <button
          onClick={onOpen}
          disabled={link.status === LinkAvailabilityStatus.UNAVAILABLE}
          className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600 disabled:opacity-40">
          开始
        </button>
        <button
          onClick={() => onCheckAvailability(link.id)}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
          检测
        </button>
        <button
          onClick={onReanalyze}
          className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50">
          重分析
        </button>
        <button
          onClick={onFavorite}
          className="rounded-lg px-3 py-1.5 text-xs hover:bg-yellow-50 dark:hover:bg-yellow-900/20">
          {link.favorite ? '★' : '☆'}
        </button>
        <button
          onClick={onEdit}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
          编辑
        </button>
        <button onClick={onDelete} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-500 hover:bg-red-100">
          删除
        </button>
      </div>
    </div>
  );
};

export { LinkCard };
