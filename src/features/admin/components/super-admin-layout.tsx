/**
 * Super Admin Layout
 *
 * Dedicated layout component for super admin pages.
 * Provides admin-specific styling, navigation, and context using better-auth.
 */

import { useRouterState } from '@tanstack/react-router'

import { SuperAdminSidebar } from './super-admin-sidebar'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useSession } from '@/lib/auth/auth-hooks'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/i18n/hooks/useTranslation'

interface SuperAdminLayoutProps {
  children: React.ReactNode
}

// Page names will be translated dynamically
const getPageNames = (t: (key: string) => string): Record<string, string> => ({
  '/superadmin': t('pages.dashboard'),
  '/superadmin/users': t('pages.userManagement'),
  '/superadmin/workspaces': t('pages.workspaceManagement'),
  '/superadmin/analytics': t('pages.analytics'),
  '/superadmin/settings': t('pages.systemSettings'),
})

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { data: session } = useSession()
  const { t } = useTranslation('admin')

  // Check superadmin access - simplified since this layout is only used on superadmin routes
  const isSuperAdmin = session?.user?.role === 'superadmin'

  // Use useRouterState for reactive pathname updates - must be called before any returns
  const currentPath = useRouterState({
    select: state => state.location.pathname,
  })
  const pageNames = getPageNames(t)
  const currentPageName = pageNames[currentPath] || t('title')

  if (!isSuperAdmin) {
    return <>{children}</>
  }

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
      <SuperAdminSidebar
        className="
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
      "
      />

      <SidebarInset>
        <PageHeader title={currentPageName} />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 bg-background">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

/**
 * Hook to determine if user can access superadmin layout
 */
export function useSuperAdminAccess() {
  const { data: session } = useSession()

  // Check if user is a superadmin (system-wide admin)
  const isSuperAdmin = session?.user?.role === 'superadmin'

  const canAccessSuperAdmin = isSuperAdmin

  return {
    canAccessSuperAdmin,
    isSuperAdmin,
    user: session?.user,
  }
}
