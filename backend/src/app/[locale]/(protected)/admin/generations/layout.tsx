import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { isDemoWebsite } from '@/lib/demo';
import { getSession } from '@/lib/server';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

interface GenerationsLayoutProps {
  children: React.ReactNode;
}

export default async function GenerationsLayout({
  children,
}: GenerationsLayoutProps) {
  const isDemo = isDemoWebsite();
  const session = await getSession();

  const user = session?.user;
  const role =
    user && typeof user === 'object' && 'role' in user
      ? (user as { role?: string }).role
      : undefined;
  const isAdmin = role === 'admin';

  if (!user || (!isAdmin && !isDemo)) {
    notFound();
  }

  const t = await getTranslations('Dashboard.admin');

  const breadcrumbs = [
    {
      label: t('title'),
      isCurrentPage: false,
    },
    {
      label: t('generations.title'),
      isCurrentPage: true,
    },
  ];

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />

      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
