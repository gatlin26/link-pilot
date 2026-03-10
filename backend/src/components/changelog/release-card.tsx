import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatDate } from '@/lib/formatter';
import type { ChangelogType } from '@/lib/source';
import { CalendarIcon, TagIcon } from 'lucide-react';
import { getMDXComponents } from '../docs/mdx-components';

interface ReleaseCardProps {
  releaseItem: ChangelogType;
  isLatest?: boolean;
  latestLabel?: string;
}

export function ReleaseCard({
  releaseItem,
  isLatest = false,
  latestLabel = 'Latest',
}: ReleaseCardProps) {
  const { title, description, date, version } = releaseItem.data;
  const formattedDate = formatDate(new Date(date));
  const MDX = releaseItem.data.body;

  return (
    <div className="relative flex gap-6 pb-8 group">
      {/* Timeline line and dot */}
      <div className="relative flex flex-col items-center">
        {/* Dot */}
        <div
          className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-4 border-background ${
            isLatest
              ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/50'
              : 'bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700'
          }`}
        >
          <TagIcon
            className={`size-4 ${isLatest ? 'text-white' : 'text-white dark:text-gray-200'}`}
          />
        </div>

        {/* Vertical line */}
        <div className="absolute top-10 bottom-0 w-0.5 bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-700" />
      </div>

      {/* Content card */}
      <div className="flex-1 -mt-1">
        <Card
          className={`transition-all duration-300 ${
            isLatest
              ? 'border-blue-200 dark:border-blue-900 shadow-lg shadow-blue-500/10'
              : 'hover:shadow-md'
          }`}
        >
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                  {isLatest && (
                    <Badge
                      variant="default"
                      className="bg-gradient-to-r from-blue-500 to-purple-600 border-0"
                    >
                      {latestLabel}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <Badge variant="outline" className="w-fit shrink-0">
                <TagIcon className="mr-1 size-3" />
                {version}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <CalendarIcon className="size-4 text-muted-foreground" />
              <time className="text-muted-foreground" dateTime={date}>
                {formattedDate}
              </time>
            </div>
          </CardHeader>

          <CardContent>
            <div className="max-w-none prose prose-neutral dark:prose-invert prose-img:rounded-lg prose-headings:font-semibold prose-h3:text-base prose-h3:mt-6 prose-h3:mb-3 prose-p:my-2 prose-li:my-1">
              <MDX components={getMDXComponents()} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
