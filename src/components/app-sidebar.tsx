/**
 * App Sidebar
 * 
 * Main navigation sidebar for the application.
 * Integrates with better-auth and organization system.
 */

import { useState } from 'react';
import { useRouter, useRouterState, Link } from '@tanstack/react-router';
import { CheckSquare, Users, Settings, CreditCard } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { UserTile } from '@/components/user-tile';
import { OrganizationSwitcher } from '@/features/organization/components/organization-switcher';
import { authClient } from '@/lib/auth/auth-client';
import { useSession } from '@/lib/auth/auth-hooks';

const baseNavigationItems = [
  {
    title: "Todos",
    url: "/todos",
    icon: CheckSquare,
    requiresPermission: null, // Everyone can access
  },
  {
    title: "Teams",
    url: "/teams",
    icon: Users,
    requiresPermission: null, // Everyone can access (with different capabilities)
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
    requiresPermission: 'billing', // Admin only
  },
  {
    title: "Workspace Settings",
    url: "/settings",
    icon: Settings,
    requiresPermission: 'workspace', // Admin only
  },
];

// SuperAdmin navigation is handled separately - not in AppSidebar

// Helper functions to check permissions based on better-auth organization roles (workspaces in our UI)
function canAdminBilling(userRoles: string[], isOwner: boolean): boolean {
  return isOwner || userRoles.includes('admin') || userRoles.includes('owner');
}

function canAdminWorkspace(userRoles: string[], isOwner: boolean): boolean {
  return isOwner || userRoles.includes('admin') || userRoles.includes('owner');
}

export function AppSidebar() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Use useRouterState for reactive pathname updates
  const currentPath = useRouterState({
    select: (state) => state.location.pathname
  });

  const user = session?.user;

  // For now, skip membership check to avoid breaking the app
  // TODO: Implement proper membership role checking
  const membership = null as { role?: string } | null;

  // Determine user permissions in current workspace
  const userRoles: string[] = membership?.role ? [membership.role] : [];
  const isOwner: boolean = membership?.role === 'owner';

  // Filter navigation items based on user permissions in current workspace
  const navigationItems = baseNavigationItems.filter(item => {
    if (!item.requiresPermission) return true;

    if (item.requiresPermission === 'billing') {
      return canAdminBilling(userRoles, isOwner);
    }

    if (item.requiresPermission === 'workspace') {
      return canAdminWorkspace(userRoles, isOwner);
    }

    return false;
  });

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            // Clear local storage items
            if (typeof window !== 'undefined') {
              const itemsToClear = [
                'activeOrganizationId',
                'admin_override_mode',
              ];

              itemsToClear.forEach(item => {
                try {
                  localStorage.removeItem(item);
                } catch (error) {
                  console.error('Error clearing localStorage item:', item, error);
                }
              });

              // Clear session storage
              try {
                sessionStorage.clear();
              } catch (error) {
                console.error('Error clearing sessionStorage:', error);
              }
            }

            // Navigate to signin
            router.navigate({
              to: '/auth/signin',
              search: {
                message: 'You have been logged out.',
                type: 'info'
              }
            });
          },
          onError: (error) => {
            console.error('Logout error:', error);
            setIsLoggingOut(false);
          }
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="px-2 py-2">
          <h2 className="text-lg font-semibold mb-2">App</h2>
          <OrganizationSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath === item.url}
                  >
                    <Link
                      to={item.url}
                      className="flex items-center gap-3"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserTile
              user={user}
              onLogout={handleLogout}
              isLoggingOut={isLoggingOut}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}