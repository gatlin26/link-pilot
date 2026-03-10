import { ChangelogLoadMore } from '@/components/changelog/changelog-load-more';
import { ReleaseCard } from '@/components/changelog/release-card';
import Container from '@/components/layout/container';
import { constructMetadata } from '@/lib/metadata';
import { changelogSource } from '@/lib/source';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { NextPageProps } from '@/types/next-page-props';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import '@/styles/mdx.css';

const INITIAL_COUNT = 5;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({ locale, namespace: 'ChangelogPage' });

  return constructMetadata({
    title: pt('title') + ' | ' + t('title'),
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/changelog', locale),
  });
}

export default async function ChangelogPage(props: NextPageProps) {
  const params = await props.params;
  if (!params) {
    notFound();
  }

  const locale = params.locale as Locale;

  // 按当前语言加载 changelog，无内容时回退到 en
  let localeReleases = changelogSource.getPages(locale);
  if (localeReleases.length === 0) {
    localeReleases = changelogSource.getPages('en');
  }

  const publishedReleases = localeReleases
    .filter((releaseItem) => releaseItem.data.published)
    .sort(
      (a, b) =>
        new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
    );

  if (!publishedReleases || publishedReleases.length === 0) {
    notFound();
  }

  const initialReleases = publishedReleases.slice(0, INITIAL_COUNT);
  const moreReleases = publishedReleases.slice(INITIAL_COUNT);
  const hasMore = moreReleases.length > 0;

  const t = await getTranslations({ locale, namespace: 'ChangelogPage' });

  return (
    <Container key={locale} className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="space-y-4 mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Timeline */}
        <div className="relative max-w-4xl mx-auto">
          {initialReleases.map((releaseItem, index) => {
            return (
              <ReleaseCard
                key={releaseItem.data.version}
                releaseItem={releaseItem}
                isLatest={index === 0}
                latestLabel={t('latestVersion')}
              />
            );
          })}

          {hasMore && (
            <ChangelogLoadMore>
              {moreReleases.map((releaseItem) => (
                <ReleaseCard
                  key={releaseItem.data.version}
                  releaseItem={releaseItem}
                  isLatest={false}
                  latestLabel={t('latestVersion')}
                />
              ))}
            </ChangelogLoadMore>
          )}

          {/* End marker */}
          {publishedReleases.length > 0 && (
            <div className="flex items-center gap-6 pl-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-background" />
              </div>
              <p className="text-sm text-muted-foreground">{t('startPoint')}</p>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
