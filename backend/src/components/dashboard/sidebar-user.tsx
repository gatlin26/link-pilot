'use client';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useLocaleRouter } from '@/i18n/navigation';
import { Routes } from '@/routes';
import type { User } from 'better-auth';
import { UserAvatar } from '../layout/user-avatar';

interface SidebarUserProps {
  user: User;
  className?: string;
}

/**
 * User navigation for the dashboard sidebar
 * Click avatar to go directly to submissions history
 */
export function SidebarUser({ user, className }: SidebarUserProps) {
  const router = useLocaleRouter();

  return (
    <SidebarMenu className="border-t pt-4">
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="cursor-pointer"
          onClick={() => router.push(Routes.SettingsSubmissions)}
        >
          <UserAvatar
            name={user.name}
            image={user.image}
            className="size-8 border"
          />

          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="truncate text-xs">{user.email}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
