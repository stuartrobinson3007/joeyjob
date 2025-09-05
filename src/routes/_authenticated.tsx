import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from '@tanstack/react-router'
import React, { useEffect } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { SuperAdminWrapper, useSuperAdminWrapper } from '@/features/admin/components/super-admin-wrapper'
import { useSession } from '@/lib/auth/auth-hooks'
import { SuperAdminLayout } from '@/features/admin/components/super-admin-layout'
import { Separator } from '@/components/taali-ui/ui/separator'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage, BreadcrumbLink, BreadcrumbSeparator } from '@/components/taali-ui/ui/breadcrumb'
import { usePageContext } from '@/lib/hooks/page-context'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout
})

function AppHeader() {
  const { title, breadcrumbs, actions, customBreadcrumb } = usePageContext()
  // Use useRouterState for reactive pathname updates
  const currentPath = useRouterState({
    select: (state) => state.location.pathname
  })

  // Generate default breadcrumbs from path if none provided
  const defaultBreadcrumbs = React.useMemo(() => {
    if (breadcrumbs.length > 0 || customBreadcrumb) return []

    const segments = currentPath.split('/').filter(Boolean)
    if (segments.length === 0) return []

    // Map common segments to friendly names
    const nameMap: Record<string, string> = {
      todos: 'Todos',
      members: 'Members',
      teams: 'Teams',
      billing: 'Billing',
      settings: 'Settings',
      superadmin: 'Super Admin',
      users: 'Users',
      workspaces: 'Workspaces'
    }

    return segments.map((segment, index) => ({
      label: nameMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
      href: index < segments.length - 1 ? '/' + segments.slice(0, index + 1).join('/') : undefined
    }))
  }, [currentPath, breadcrumbs, customBreadcrumb])

  const displayBreadcrumbs = breadcrumbs.length > 0 ? breadcrumbs : defaultBreadcrumbs

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {customBreadcrumb ? (
          customBreadcrumb
        ) : title ? (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : displayBreadcrumbs.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList>
              {displayBreadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {item.href ? (
                      <BreadcrumbLink asChild>
                        <Link to={item.href}>{item.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index < displayBreadcrumbs.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}
      </div>
      {actions && (
        <div className="ml-auto px-4">
          {actions}
        </div>
      )}
    </header>
  )
}

function AuthenticatedLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  // Get SuperAdminWrapper props for overlay
  const superAdminProps = useSuperAdminWrapper()

  // Check if we're on superadmin routes
  // Use useRouterState for reactive pathname updates
  const currentPath = useRouterState({
    select: (state) => state.location.pathname
  })
  const isSuperAdminRoute = currentPath.startsWith('/superadmin')

  useEffect(() => {
    if (!isPending) {
      if (!session) {
        navigate({ to: '/auth/signin' })
        return
      }

      if (!session.user.onboardingCompleted) {
        navigate({ to: '/onboarding' })
        return
      }
    }
  }, [session, isPending, navigate])

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!session || !session.user.onboardingCompleted) {
    return null // Will redirect via useEffect
  }

  if (isSuperAdminRoute) {
    return (
      <>
        <SuperAdminLayout>
          <Outlet />
        </SuperAdminLayout>
        <SuperAdminWrapper {...superAdminProps} />
      </>
    )
  }

  // For regular routes, use AppSidebar
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <SuperAdminWrapper {...superAdminProps} />
    </>
  )
}