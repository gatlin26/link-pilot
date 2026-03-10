'use client';

import { isDemoWebsite } from '@/lib/demo';
import { Routes } from '@/routes';
import type { NestedMenuItem } from '@/types';
import {
  CircleUserRoundIcon,
  ClipboardListIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LockKeyholeIcon,
  MessageSquareIcon,
  Settings2Icon,
  SettingsIcon,
  TagIcon,
  UsersRoundIcon,
  WrenchIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { websiteConfig } from './website';

/**
 * Get sidebar config with translations
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://mksaas.com/docs/config/sidebar
 *
 * @returns The sidebar config with translated titles and descriptions
 */
export function useSidebarLinks(): NestedMenuItem[] {
  const t = useTranslations('Dashboard');

  // if is demo website, allow user to access admin and user pages, but data is fake
  const isDemo = isDemoWebsite();

  return [
    // 1. 管理员菜单（仅管理员可见）
    {
      title: t('admin.title'),
      icon: <SettingsIcon className="size-4 shrink-0" />,
      authorizeOnly: isDemo ? ['admin', 'user'] : ['admin'],
      items: [
        {
          title: t('admin.dashboard.title'),
          icon: <LayoutDashboardIcon className="size-4 shrink-0" />,
          href: Routes.Admin,
          external: false,
        },
        {
          title: t('admin.users.title'),
          icon: <UsersRoundIcon className="size-4 shrink-0" />,
          href: Routes.AdminUsers,
          external: false,
        },
        {
          title: t('admin.submissions.title'),
          icon: <ClipboardListIcon className="size-4 shrink-0" />,
          href: Routes.AdminSubmissions,
          external: false,
        },
        {
          title: t('admin.tools.title'),
          icon: <WrenchIcon className="size-4 shrink-0" />,
          href: Routes.AdminTools,
          external: false,
        },
        {
          title: t('admin.tags.title'),
          icon: <TagIcon className="size-4 shrink-0" />,
          href: Routes.AdminTags,
          external: false,
        },
        {
          title: t('admin.reviews.title'),
          icon: <MessageSquareIcon className="size-4 shrink-0" />,
          href: Routes.AdminReviews,
          external: false,
        },
      ],
    },
    // 2. 创作区（核心功能）
    // 已移除，相关功能已整合到其他页面
    // {
    //   title: t('studio.title'),
    //   icon: <Sparkles className="size-4 shrink-0" />,
    //   items: [
    //     // MVP 阶段暂时隐藏视频功能
    //     // {
    //     //   title: t('studio.videos'),
    //     //   icon: <Video className="size-4 shrink-0" />,
    //     //   href: Routes.AppVideo,
    //     //   external: false,
    //     // },
    //   ],
    // },
    // 3. 账户设置
    {
      title: t('settings.title'),
      icon: <Settings2Icon className="size-4 shrink-0" />,
      items: [
        {
          title: t('settings.profile.title'),
          icon: <CircleUserRoundIcon className="size-4 shrink-0" />,
          href: Routes.SettingsProfile,
          external: false,
        },
        {
          title: t('settings.security.title'),
          icon: <LockKeyholeIcon className="size-4 shrink-0" />,
          href: Routes.SettingsSecurity,
          external: false,
        },
        {
          title: t('settings.submissions.title'),
          icon: <FileTextIcon className="size-4 shrink-0" />,
          href: Routes.SettingsSubmissions,
          external: false,
        },
        // 历史记录已合并到"我的作品"页面，不再单独显示
      ],
    },
  ];
}
