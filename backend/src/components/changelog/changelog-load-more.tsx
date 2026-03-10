'use client';

import { Button } from '@/components/ui/button';
import { ChevronDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface ChangelogLoadMoreProps {
  children: React.ReactNode;
}

export function ChangelogLoadMore({ children }: ChangelogLoadMoreProps) {
  const t = useTranslations('ChangelogPage');
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return <>{children}</>;
  }

  return (
    <div className="flex justify-center pt-4 pb-8">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExpanded(true)}
        className="gap-2"
      >
        <ChevronDownIcon className="size-4" />
        {t('viewMore')}
      </Button>
    </div>
  );
}
