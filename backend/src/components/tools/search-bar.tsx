'use client';

import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

interface SearchBarProps {
  locale: string;
  initialQuery?: string;
}

export function SearchBar({ locale, initialQuery = '' }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const t = useTranslations('ToolsPage');

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(
        `/${locale}/tools?search=${encodeURIComponent(query.trim())}`
      );
    }
  };

  const handleClear = () => {
    setQuery('');
    router.push(`/${locale}/tools`);
  };

  return (
    <form onSubmit={handleSearch} className="mb-8">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#64748b] dark:text-[#94a3b8]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-xl border-2 border-[#e2e8f0] bg-white py-3 pl-12 pr-24 text-[#0f172a] transition-all placeholder:text-[#94a3b8] hover:border-[#cbd5e1] focus:border-[#0052ff] focus:outline-none focus:ring-4 focus:ring-[#0052ff]/10 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f8fafc] dark:hover:border-[#475569] dark:focus:border-[#3d8bff]"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
