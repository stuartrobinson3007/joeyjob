/**
 * App Sidebar with role-based access control
 */

import { useState, useEffect } from 'react';
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
import { useActiveOrganization } from '@/features/organization/lib/organization-context';
import { queryClient } from '@/lib/hooks/providers';

const baseNavigationItems = [
  {
    title: "Todos",
    url: "/",
    icon: CheckSquare,
    requiresPermission: null, // Everyone can access
  },
  {
    title: "Team",
    url: "/team",
    icon: Users,
    requiresPermission: null, // Everyone can access (with different capabilities)
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
    requiresPermission: 'billing',
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    requiresPermission: 'workspace',
  },
];

// Permission helper functions
const hasAdminPermission = (role: string | null): boolean => {
  return role === 'owner' || role === 'admin';
};

export function AppSidebar() {
  const router = useRouter();
  const { data: session } = useSession();
  const { activeOrganizationId } = useActiveOrganization();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [memberRole, setMemberRole] = useState<string | null>(null);

  const currentPath = useRouterState({
    select: (state) => state.location.pathname
  });

  const user = session?.user;
  const isImpersonating = !!(session as any)?.session?.impersonatedBy;

  // Get the user's role in the active organization
  useEffect(() => {
    async function fetchMemberRole() {
      if (!activeOrganizationId || !user?.id) {
        setMemberRole(null);
        return;
      }

      try {
        const response = await authClient.organization.listMembers({
          query: { organizationId: activeOrganizationId }
        });

        // Handle different response structures from Better Auth
        let membersArray: any[] = [];

        if (response && 'members' in response) {
          // Response has members property
          membersArray = response.members || [];
        } else if (response && 'data' in response) {
          // Response has data property
          const data = response.data;
          if (Array.isArray(data)) {
            membersArray = data;
          } else if (data && 'members' in data) {
            membersArray = data.members || [];
          }
        } else if (Array.isArray(response)) {
          // Response is directly an array
          membersArray = response;
        }

        // Find the current user's membership
        const currentUserMember = membersArray.find((m: any) => m.userId === user.id);
        setMemberRole(currentUserMember?.role || null);
      } catch (error) {
        setMemberRole(null);
      }
    }

    fetchMemberRole();
  }, [activeOrganizationId, user?.id]);

  // Filter navigation items based on user permissions
  const navigationItems = baseNavigationItems.filter(item => {
    if (!item.requiresPermission) return true;

    // Billing and Settings require admin or owner role
    return hasAdminPermission(memberRole);
  });

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: async () => {
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

            // IMPORTANT: Invalidate all queries to clear cached session
            await queryClient.invalidateQueries();
            await queryClient.clear();

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
              user={user ? { ...user, isImpersonating } : user}
              onLogout={handleLogout}
              isLoggingOut={isLoggingOut}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}