import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { isDemoWebsite } from '@/lib/demo';
import { getSession } from '@/lib/server';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

interface UsersLayoutProps {
  children: React.ReactNode;
}

export default async function UsersLayout({ children }: UsersLayoutProps) {
  // if is demo website, allow user to access admin and user pages, but data is fake
  const isDemo = isDemoWebsite();
  // Check if user is admin
  const session = await getSession();
  /**
   * NOTE:
   * `getSession()` 返回的 `session.user` 类型在当前工程里并不保证包含 `role` 字段。
   * 直接访问会导致 TS 构建失败（即使运行时可能存在该字段）。
   * 这里用一个轻量的类型守卫做探测：没有 role 就视为非 admin。
   */
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
      label: t('users.title'),
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
