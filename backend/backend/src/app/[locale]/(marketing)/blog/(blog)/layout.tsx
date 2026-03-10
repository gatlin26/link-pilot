import Container from '@/components/layout/container';
import { getTranslations } from 'next-intl/server';
import type { PropsWithChildren } from 'react';

interface BlogListLayoutProps extends PropsWithChildren {
  params: Promise<{ locale: string }>;
}

export default async function BlogListLayout({
  children,
  params,
}: BlogListLayoutProps) {
  const { locale } = await params;
  const t = await getTranslations('BlogPage');

  return (
    <div className="mb-16">
      <Container className="mt-8 px-4">
        {/* Header */}
        <div className="space-y-4 mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {t('subtitle')}
          </p>
        </div>

        {children}
      </Container>
    </div>
  );
}
