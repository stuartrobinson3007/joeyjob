import { createFileRoute, Outlet, useNavigate, useRouterState, Link, useMatches } from '@tanstack/react-router'
import React, { useEffect } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { SuperAdminWrapper, useSuperAdminWrapper } from '@/features/admin/components/super-admin-wrapper'
import { useSession } from '@/lib/auth/auth-hooks'
import { SuperAdminLayout } from '@/features/admin/components/super-admin-layout'
import { Separator } from '@/components/taali-ui/ui/separator'
import { authClient } from '@/lib/auth/auth-client'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout
})


function AuthenticatedLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  const matches = useMatches()

  // Get SuperAdminWrapper props for overlay
  const superAdminProps = useSuperAdminWrapper()

  // Check if we're on superadmin routes
  // Use useRouterState for reactive pathname updates
  const currentPath = useRouterState({
    select: (state) => state.location.pathname
  })
  const isSuperAdminRoute = currentPath.startsWith('/superadmin')

  // Check current route staticData for sidebar preference
  // Default to true (show sidebar) if not specified
  const currentMatch = matches[matches.length - 1]
  const showSidebar = currentMatch?.staticData?.sidebar !== false

  useEffect(() => {
    if (!isPending) {
      if (!session) {
        navigate({ to: '/auth/signin' })
        return
      }

      // Don't redirect to onboarding if we're already on the onboarding page
      if (!session.user.onboardingCompleted && currentPath !== '/onboarding') {
        navigate({ to: '/onboarding' })
        return
      }
    }
  }, [session, isPending, navigate, currentPath])

  // End impersonation when navigating to superadmin routes
  useEffect(() => {
    const endImpersonationIfNeeded = async () => {
      if (isSuperAdminRoute && session?.session?.impersonatedBy) {
        try {
          await authClient.admin.stopImpersonating()
          window.location.reload()
        } catch (error) {
          console.error('Failed to stop impersonation:', error)
        }
      }
    }

    if (!isPending && session) {
      endImpersonationIfNeeded()
    }
  }, [isSuperAdminRoute, session, isPending])

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
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

  // Routes without sidebar (controlled by staticData)
  if (!showSidebar) {
    return (
      <>
        <div className="min-h-screen">
          <Outlet />
        </div>
        <SuperAdminWrapper {...superAdminProps} />
      </>
    )
  }

  // Regular routes with sidebar
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <SuperAdminWrapper {...superAdminProps} />
    </>
  )
}