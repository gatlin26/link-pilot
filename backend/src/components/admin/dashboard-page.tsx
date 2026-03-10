'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LocaleLink } from '@/i18n/navigation';
import { formatDate } from '@/lib/formatter';
import { Routes } from '@/routes';
import {
  AlertCircleIcon,
  ClipboardListIcon,
  CreditCardIcon,
  MessageSquareIcon,
  UsersRoundIcon,
  WrenchIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DashboardStats {
  userCount: number;
  submissionCount: number;
  pendingCount: number;
  publishedToolsCount: number;
  newToolsCount: number;
}

interface RecentPayment {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  userId: string;
  userName: string | null;
  userEmail: string | null;
}

interface RecentSubmission {
  id: string;
  name: string;
  status: string;
  email: string | null;
  createdAt: Date;
}

interface DashboardPageClientProps {
  stats: DashboardStats | null;
  recentPayments: RecentPayment[];
  recentSubmissions: RecentSubmission[];
  error?: string;
}

const statCards = [
  {
    key: 'users' as const,
    href: Routes.AdminUsers,
    icon: UsersRoundIcon,
  },
  {
    key: 'submissions' as const,
    href: Routes.AdminSubmissions,
    icon: ClipboardListIcon,
  },
  {
    key: 'tools' as const,
    href: Routes.AdminTools,
    icon: WrenchIcon,
  },
  {
    key: 'pending' as const,
    href: Routes.AdminSubmissions,
    icon: MessageSquareIcon,
  },
] as const;

export function DashboardPageClient({
  stats,
  recentPayments,
  recentSubmissions,
  error,
}: DashboardPageClientProps) {
  const t = useTranslations('Dashboard.admin.dashboard');

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="size-4" />
        <AlertTitle>{t('errorTitle')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const displayStats = stats ?? {
    userCount: 0,
    submissionCount: 0,
    pendingCount: 0,
    publishedToolsCount: 0,
    newToolsCount: 0,
  };

  const getStatValue = (key: (typeof statCards)[number]['key']) => {
    switch (key) {
      case 'users':
        return displayStats.userCount;
      case 'submissions':
        return displayStats.submissionCount;
      case 'tools':
        return displayStats.publishedToolsCount;
      case 'pending':
        return displayStats.pendingCount;
      default:
        return 0;
    }
  };

  const getStatLabel = (key: (typeof statCards)[number]['key']) => {
    switch (key) {
      case 'users':
        return t('stats.users');
      case 'submissions':
        return t('stats.submissions');
      case 'tools':
        return t('stats.tools');
      case 'pending':
        return t('stats.pending');
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ key, href, icon: Icon }) => (
          <LocaleLink key={key} href={href}>
            <Card className="cursor-pointer transition-colors hover:bg-accent/50">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Icon className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{getStatValue(key)}</p>
                  <p className="text-sm text-muted-foreground">
                    {getStatLabel(key)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </LocaleLink>
        ))}
      </div>

      {/* 近30天新增工具 */}
      {displayStats.newToolsCount > 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {t('stats.newTools', { count: displayStats.newToolsCount })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 最新订单 + 最新提交 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 最新订单 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="size-5" />
              {t('latestPayments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('emptyPayments')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('payments.user')}</TableHead>
                    <TableHead>{t('payments.type')}</TableHead>
                    <TableHead>{t('payments.status')}</TableHead>
                    <TableHead>{t('payments.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.userName ?? p.userEmail ?? p.userId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.type === 'subscription'
                            ? t('payments.subscription')
                            : t('payments.oneTime')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === 'active' ||
                            p.status === 'completed' ||
                            p.status === 'trialing'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(new Date(p.createdAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 最新提交 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardListIcon className="size-5" />
              {t('latestSubmissions')}
            </CardTitle>
            <LocaleLink
              href={Routes.AdminSubmissions}
              className="text-sm text-primary hover:underline"
            >
              {t('viewAll')}
            </LocaleLink>
          </CardHeader>
          <CardContent>
            {recentSubmissions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('emptySubmissions')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('submissions.name')}</TableHead>
                    <TableHead>{t('submissions.submitter')}</TableHead>
                    <TableHead>{t('submissions.status')}</TableHead>
                    <TableHead>{t('submissions.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSubmissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.email ?? '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.status === 'pending'
                              ? 'default'
                              : s.status === 'approved'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(new Date(s.createdAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
