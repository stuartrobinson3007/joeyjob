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
import { useOrganizationsWithOnboarding } from '@/lib/hooks/use-organizations-with-onboarding'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // Import here to avoid circular dependencies
    const { auth } = await import('@/lib/auth/auth')
    const { getWebRequest } = await import('@tanstack/react-start/server')
    
    const request = getWebRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session) {
      throw redirect({ 
        to: '/auth/signin',
        search: { redirect: location.href }
      })
    }
    
    // Check user onboarding completion
    if (!session.user.onboardingCompleted && location.pathname !== '/onboarding') {
      throw redirect({ to: '/onboarding' })
    }
    
    return {
      user: session.user,
      session: session
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {

  const { data: session, isPending: sessionPending } = useSession()

  // Only fetch organizations if user is authenticated
  const { data: organizations, isPending: orgsPending, error: orgsError } = useListOrganizations({
    enabled: !!session && !sessionPending
  })

  // Also fetch organizations with onboarding status for checking completion (only when authenticated)
  const { data: organizationsWithOnboarding, isPending: onboardingOrgsPending } = useOrganizationsWithOnboarding({
    enabled: !!session && !sessionPending
  })


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

  console.log('🔄 [DEBUG] AuthenticatedLayout - currentPath:', currentPath)

  useEffect(() => {
    // Handle unauthenticated users immediately (no need to wait for orgs)
    if (!sessionPending && !session) {
      navigate({ to: '/auth/signin' })
      return
    }

    // For authenticated users, wait for both session and organizations
    if (!sessionPending && session && !orgsPending && !onboardingOrgsPending) {
      console.log('🔄 [DEBUG] AuthenticatedLayout - checking redirects for:', currentPath)

      // Routes that require organization onboarding to be complete
      const orgRequiredPaths = [
        '/', '/forms', '/billing', '/choose-plan', '/payment-error', 
        '/settings', '/team', '/todos'
      ]
      
      const needsCompleteOrg = orgRequiredPaths.some(path => 
        currentPath === path || currentPath.startsWith(path + '/')
      )

      console.log('🔄 [DEBUG] Route analysis:', {
        currentPath,
        needsCompleteOrg,
        userOnboardingComplete: session.user.onboardingCompleted
      })

      if (needsCompleteOrg && session.user.onboardingCompleted) {
        const activeOrgId = getActiveOrganizationId()
        console.log('🔄 [DEBUG] Organization checks:', { activeOrgId })

        // If no active org ID, redirect to select organization
        if (!activeOrgId || (organizations && !organizations.find(org => org.id === activeOrgId))) {
          console.log('➡️ [DEBUG] Redirecting to select-organization (no active org)')
          navigate({ to: '/select-organization' })
          return
        }

        // Check if current organization has completed onboarding
        const currentOrgWithOnboarding = organizationsWithOnboarding?.find(org => org.id === activeOrgId)
        if (currentOrgWithOnboarding && !currentOrgWithOnboarding.onboardingCompleted) {
          console.log('➡️ [DEBUG] Redirecting to company-sync (org onboarding incomplete)')
          navigate({ to: '/onboarding/company-sync' })
          return
        }

        console.log('✅ [DEBUG] All org checks passed for:', currentPath)
      }
    }
  }, [session, organizations, organizationsWithOnboarding, sessionPending, orgsPending, onboardingOrgsPending, navigate, currentPath])

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
