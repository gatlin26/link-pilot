import { getDashboardStatsAction } from '@/actions/admin/get-dashboard-stats';
import { DashboardPageClient } from '@/components/admin/dashboard-page';

/**
 * Admin 仪表盘首页
 * URL: /admin
 */
export default async function AdminDashboardPage() {
  const result = await getDashboardStatsAction({});

  // next-safe-action: result.data = our return { success, data }
  const actionData = result?.data;
  const innerData = actionData?.success ? actionData?.data : undefined;
  const errorMsg =
    result?.serverError ??
    (actionData && !actionData.success ? actionData?.error : undefined);

  if (!innerData) {
    return (
      <DashboardPageClient
        stats={null}
        recentPayments={[]}
        recentSubmissions={[]}
        error={errorMsg ?? 'Failed to load dashboard'}
      />
    );
  }

  return (
    <DashboardPageClient
      stats={innerData.stats}
      recentPayments={innerData.recentPayments ?? []}
      recentSubmissions={innerData.recentSubmissions ?? []}
    />
  );
}
