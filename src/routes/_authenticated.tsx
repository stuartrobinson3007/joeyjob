import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
  useMatches,
  redirect,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SuperAdminWrapper,
  useSuperAdminWrapper,
} from '@/features/admin/components/super-admin-wrapper'
import { useSession, useListOrganizations } from '@/lib/auth/auth-hooks'
import { SuperAdminLayout } from '@/features/admin/components/super-admin-layout'
import { authClient } from '@/lib/auth/auth-client'
import { getActiveOrganizationId } from '@/features/organization/lib/organization-utils'
import { useSubscription } from '@/features/billing/hooks/use-subscription'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {

  const { data: session, isPending: sessionPending } = useSession()

  // Only fetch organizations if user is authenticated
  const { data: organizations, isPending: orgsPending, error: orgsError } = useListOrganizations({
    enabled: !!session && !sessionPending
  })

  // Better Auth now includes all custom fields via additionalFields configuration


  // Only fetch subscription if user has completed onboarding
  const { data: subscription, isPending: subscriptionPending, fetchStatus: subscriptionFetchStatus } = useSubscription({
    enabled: !!session?.user?.onboardingCompleted && !sessionPending
  })
  const navigate = useNavigate()
  const matches = useMatches()

  // Get SuperAdminWrapper props for overlay
  const superAdminProps = useSuperAdminWrapper()

  // Check if we're on superadmin routes
  // Use useRouterState for reactive pathname updates
  const currentPath = useRouterState({
    select: state => state.location.pathname,
  })
  const isSuperAdminRoute = currentPath.startsWith('/superadmin')

  // Check current route staticData for sidebar preference
  // Default to true (show sidebar) if not specified
  const currentMatch = matches[matches.length - 1]
  const showSidebar = currentMatch?.staticData?.sidebar !== false


  useEffect(() => {
    // Handle unauthenticated users immediately (no need to wait for orgs)
    if (!sessionPending && !session) {
      navigate({ to: '/auth/signin' })
      return
    }

    // For authenticated users, wait for both session and organizations
    if (!sessionPending && session && !orgsPending) {

      // Check if current route requires organization access
      // Routes can opt-out of org check via staticData.skipOrgCheck
      // Check all matched routes in the hierarchy (for nested routes like /superadmin/users)
      const shouldSkipOrgCheck = matches.some(match => match.staticData?.skipOrgCheck === true)
      const needsCompleteOrg = !shouldSkipOrgCheck


      if (needsCompleteOrg && session.user.onboardingCompleted) {
        const activeOrgId = getActiveOrganizationId()

        // If no active org ID, redirect to select organization
        if (!activeOrgId || (organizations && !organizations.find(org => org.id === activeOrgId))) {
          navigate({ to: '/select-organization' })
          return
        }

        // Check if current organization has completed onboarding
        const currentOrg = organizations?.find(org => org.id === activeOrgId)
        console.log('🔄 [DEBUG] Layout org onboarding check:', {
          currentPath,
          hasCurrentOrg: !!currentOrg,
          onboardingCompleted: currentOrg?.onboardingCompleted,
          startsWithCompanySetup: currentPath.startsWith('/company-setup'),
          shouldRedirect: currentOrg && !currentOrg.onboardingCompleted && !currentPath.startsWith('/company-setup')
        })
        
        if (currentOrg && !currentOrg.onboardingCompleted && !currentPath.startsWith('/company-setup')) {
          console.log('🔄 [DEBUG] Layout redirecting to company-setup/company-info from:', currentPath)
          navigate({ to: '/company-setup/company-info' })
          return
        } else if (currentPath.startsWith('/company-setup')) {
          console.log('🔄 [DEBUG] Layout allowing company-setup route:', currentPath)
        }

      }
    }
  }, [session, organizations, sessionPending, orgsPending, navigate, currentPath])

  // End impersonation when navigating to superadmin routes
  useEffect(() => {
    const endImpersonationIfNeeded = async () => {
      if (isSuperAdminRoute && session?.session?.impersonatedBy) {
        try {
          await authClient.admin.stopImpersonating()
          window.location.reload()
        } catch (_error) {
          // Failed to stop impersonation - error handled by showError
        }
      }
    }

    if (!sessionPending && session) {
      endImpersonationIfNeeded()
    }
  }, [isSuperAdminRoute, session, sessionPending])

  // Only show loading if subscription is actually fetching (not just pending due to being disabled)
  const isSubscriptionActuallyLoading = session?.user?.onboardingCompleted &&
    subscriptionPending &&
    subscriptionFetchStatus === 'fetching'

  if (sessionPending || orgsPending || isSubscriptionActuallyLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="size-6 animate-spin" />
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
