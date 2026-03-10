/**
 * @file tools-showcase-section-wrapper.tsx
 * @description Server component wrapper for Tools Showcase Section (database-backed)
 * @author yiangto
 * @date 2026-02-03
 */

import { getTools } from '@/actions/tools/get-tools';
import { ToolsShowcaseSectionClient } from './tools-showcase-section-client';

interface ToolsShowcaseSectionProps {
  locale: string;
}

export async function ToolsShowcaseSection({
  locale,
}: ToolsShowcaseSectionProps) {
  // 从数据库获取前 12 个精选工具
  const { items } = await getTools({
    locale,
    page: 1,
    pageSize: 12,
    featured: true,
    published: true,
  });

  // 转换为客户端组件需要的格式
  const tools = items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description || '',
    image: item.thumbnailUrl || item.imageUrl || '',
    href: `/tools/${item.slug}`,
    category: item.tags || [],
    badge: item.featured ? 'Featured' : undefined,
  }));

  return <ToolsShowcaseSectionClient tools={tools} locale={locale} />;
}
