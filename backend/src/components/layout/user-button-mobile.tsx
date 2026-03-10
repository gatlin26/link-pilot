'use client';

import { UserAvatar } from '@/components/layout/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocaleRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { Routes } from '@/routes';
import type { User } from 'better-auth';
import { FileText, LogOut, Shield, UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface UserButtonProps {
  user: User & { role?: string };
}

export function UserButtonMobile({ user }: UserButtonProps) {
  const localeRouter = useLocaleRouter();
  const t = useTranslations('Common');
  const tDashboard = useTranslations('Dashboard');

  const isAdmin = user.role === 'admin';

  const handleSignOut = async () => {
    const { error } = await authClient.signOut();
    if (error) return;
    localeRouter.replace(Routes.Root);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t('logout')}
        >
          <UserAvatar
            name={user.name}
            image={user.image}
            className="size-8 border cursor-pointer"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {isAdmin && (
          <>
            <DropdownMenuItem
              className="cursor-pointer bg-primary/5 dark:bg-primary/10"
              onClick={() => localeRouter.push('/admin')}
            >
              <Shield className="mr-2 size-4 text-primary" />
              <span className="font-medium text-primary">
                {tDashboard('admin.title')}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => localeRouter.push(Routes.SettingsProfile)}
        >
          <UserIcon className="mr-2 size-4" />
          {tDashboard('settings.profile.title')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => localeRouter.push(Routes.SettingsSubmissions)}
        >
          <FileText className="mr-2 size-4" />
          {tDashboard('settings.submissions.title')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 size-4" />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
