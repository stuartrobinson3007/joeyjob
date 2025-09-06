/**
 * User Tile Component
 * 
 * Displays user information and provides logout functionality.
 * Used in sidebars and admin interfaces.
 */

import { useNavigate } from '@tanstack/react-router';
import { LogOut, User, MoreVertical, Check, Sun, Moon, Monitor, ShieldUser, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/taali-ui/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
} from '@/components/taali-ui/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { useMemo } from 'react';

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string;
  image?: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
  isImpersonating?: boolean;
}

interface UserTileProps {
  user?: User | null;
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

// Helper functions
function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return 'User';

  if (user.name) return user.name;

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (fullName) return fullName;

  return user.email.split('@')[0];
}

function getUserInitials(user: User | null | undefined): string {
  if (!user) return 'U';

  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }

  const displayName = getUserDisplayName(user);
  return displayName.charAt(0).toUpperCase();
}

export function UserTile({ user, onLogout, isLoggingOut = false }: UserTileProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const isSuperAdmin = useMemo(() => user?.role === 'superadmin', [user]);

  if (!user) {
    return (
      <div className="flex items-center gap-2 p-2">
        <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
        <div className="flex flex-col gap-1">
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return Sun;
      case 'dark':
        return Moon;
      case 'system':
        return Monitor;
      default:
        return Sun;
    }
  };

  const ThemeIcon = getThemeIcon();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <Avatar className="h-6 w-6">
            <AvatarImage src={user.image || undefined} />
            <AvatarFallback>
              {getUserInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-left flex-1">
            <span className="text-sm font-medium">
              {getUserDisplayName(user)}
            </span>
          </div>
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ThemeIcon className="h-4 w-4 mr-2" />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Check className={`h-4 w-4 mr-2 ${theme === 'light' ? 'opacity-100' : 'opacity-0'}`} />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Check className={`h-4 w-4 mr-2 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`} />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Check className={`h-4 w-4 mr-2 ${theme === 'system' ? 'opacity-100' : 'opacity-0'}`} />
              System
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Superadmin access - only show if user is superadmin */}
        {isSuperAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: '/superadmin/users' })}>
              <ShieldUser className="h-4 w-4 mr-2" />
              Super Admin
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          disabled={isLoggingOut || user?.isImpersonating}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {user?.isImpersonating ? 'Logout disabled during impersonation' : (isLoggingOut ? 'Signing out...' : 'Logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}