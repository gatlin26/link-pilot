'use client';

import { getRelatedToolsAction } from '@/actions/tools/get-related-tools';
import { ToolCard } from '@/components/tools/tool-card';
import type { SerializableTool } from '@/lib/source';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

interface RelatedTool {
  id: string;
  slug: string;
  name: string;
  url: string;
  iconUrl: string | null;
  thumbnailUrl: string | null;
  featured: boolean;
  matchCount: number;
  relevanceScore: number;
  matchedTags: {
    slug: string;
    name: string;
    category: string | null;
    sortOrder: number | null;
  }[];
  translation: {
    description: string | null;
  } | null;
}

interface RelatedToolsSectionProps {
  toolId: string;
  locale: string;
  limit?: number;
}

export function RelatedToolsSection({
  toolId,
  locale,
  limit = 4,
}: RelatedToolsSectionProps) {
  const t = useTranslations('ToolsPage.similarTools');
  const [tools, setTools] = useState<RelatedTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRelatedTools() {
      try {
        const result = await getRelatedToolsAction({ toolId, locale, limit });
        if (result?.data?.success && result.data.data) {
          setTools(result.data.data.tools);
        }
      } catch (error) {
        console.error('Failed to fetch related tools:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRelatedTools();
  }, [toolId, locale, limit]);

  const displayTools = useMemo(
    () => tools.slice(0, Math.min(Math.max(limit, 3), 6)),
    [limit, tools]
  );

  const serializableTools = useMemo<SerializableTool[]>(
    () =>
      displayTools.map((tool) => ({
        data: {
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
          title: tool.name,
          description: tool.translation?.description || '',
          href: `/tools/${tool.slug}`,
          url: tool.url,
          image: tool.thumbnailUrl || tool.iconUrl || '',
          thumbnailUrl: tool.thumbnailUrl || tool.iconUrl || '',
          collectionTime: '',
          starRating: 0,
          category: [],
          tags: tool.matchedTags.map((tag) => tag.slug),
          tagDetails: tool.matchedTags.map((tag) => ({
            slug: tag.slug,
            name: tag.name,
          })),
          featured: tool.featured,
          published: true,
          badge: tool.featured ? 'Featured' : undefined,
        },
      })),
    [displayTools]
  );

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-6">{t('title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: Math.min(Math.max(limit, 3), 4) }).map(
            (_, i) => (
              <div
                key={i}
                className="aspect-[4/5] rounded-2xl border bg-muted/40 animate-pulse"
              />
            )
          )}
        </div>
      </section>
    );
  }

  if (serializableTools.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-6">{t('title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {serializableTools.map((tool, index) => (
          <ToolCard
            key={tool.data.id}
            tool={tool}
            index={index}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}
