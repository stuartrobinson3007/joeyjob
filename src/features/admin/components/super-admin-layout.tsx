/**
 * Super Admin Layout
 * 
 * Dedicated layout component for super admin pages.
 * Provides admin-specific styling, navigation, and context using better-auth.
 */

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/taali-ui/ui/separator';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage } from '@/components/taali-ui/ui/breadcrumb';
import { ShieldUser } from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';
import { SuperAdminSidebar } from './super-admin-sidebar';
import { useSession } from '@/lib/auth/auth-hooks';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

const pageNames: Record<string, string> = {
  '/superadmin': 'Dashboard',
  '/superadmin/users': 'User Management',
  '/superadmin/workspaces': 'Workspace Management',
  '/superadmin/analytics': 'Analytics',
  '/superadmin/settings': 'System Settings',
};

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { data: session } = useSession();

  // Check superadmin access - simplified since this layout is only used on superadmin routes
  const isSuperAdmin = session?.user?.role === 'superadmin';

  if (!isSuperAdmin) {
    return <>{children}</>;
  }

  // Use useRouterState for reactive pathname updates
  const currentPath = useRouterState({ 
    select: (state) => state.location.pathname 
  });
  const currentPageName = pageNames[currentPath] || 'Super Admin';

  return (
    <SidebarProvider
      defaultOpen={true}
      className="
        [--sidebar-foreground:theme(colors.white)] 
        dark:[--sidebar-foreground:theme(colors.purple.50)]
        [--sidebar:theme(colors.purple.700)] 
        dark:[--sidebar:theme(colors.purple.950)]
        [--sidebar-border:theme(colors.purple.500)] 
        dark:[--sidebar-border:theme(colors.purple.900)]
        [--sidebar-accent:theme(colors.purple.600)] 
        dark:[--sidebar-accent:theme(colors.purple.900)]
        [--sidebar-accent-foreground:theme(colors.white)] 
        dark:[--sidebar-accent-foreground:theme(colors.purple.50)]
        [--sidebar-primary:theme(colors.white)] 
        dark:[--sidebar-primary:theme(colors.purple.400)]
        [--sidebar-primary-foreground:theme(colors.white)] 
        dark:[--sidebar-primary-foreground:theme(colors.purple.50)]
        [--sidebar-ring:theme(colors.purple.500)] 
        dark:[--sidebar-ring:theme(colors.purple.400)]
      "
    >
      <SuperAdminSidebar className="
        [--muted:theme(colors.purple.400)] 
        dark:[--muted:theme(colors.purple.800)]
        [--muted-foreground:theme(colors.purple.200)] 
        dark:[--muted-foreground:theme(colors.purple.300)]
        [--border:theme(colors.purple.300)] 
        dark:[--border:theme(colors.purple.800)]
        [--secondary:theme(colors.purple.400)] 
        dark:[--secondary:theme(colors.purple.800)]
        [--secondary-foreground:theme(colors.white)] 
        dark:[--secondary-foreground:theme(colors.purple.50)]
        [--ring:theme(colors.purple.500)] 
        dark:[--ring:theme(colors.purple.400)]
        [--accent:theme(colors.purple.600)] 
        dark:[--accent:theme(colors.purple.800)]
        [--accent-foreground:theme(colors.white)] 
        dark:[--accent-foreground:theme(colors.purple.50)]
      " />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-background border-b">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <ShieldUser className="h-4 w-4 text-purple-600" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-foreground font-medium">
                    {currentPageName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4 text-sm text-purple-700 dark:text-purple-300">
            System Administration Mode
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * Hook to determine if user can access superadmin layout
 */
export function useSuperAdminAccess() {
  const { data: session } = useSession();

  // Check if user is a superadmin (system-wide admin)
  const isSuperAdmin = session?.user?.role === 'superadmin';

  const canAccessSuperAdmin = isSuperAdmin;

  return {
    canAccessSuperAdmin,
    isSuperAdmin,
    user: session?.user
  };
}