import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
  useMatches,
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
  console.log('[AuthenticatedLayout] Component rendering')
  
  const { data: session, isPending: sessionPending } = useSession()
  console.log('[AuthenticatedLayout] Session state:', { session, sessionPending })
  
  // Only fetch organizations if user is authenticated
  const { data: organizations, isPending: orgsPending, error: orgsError } = useListOrganizations({
    enabled: !!session && !sessionPending
  })
  console.log('[AuthenticatedLayout] Organizations state:', { 
    organizations, 
    orgsPending, 
    orgsError,
    enabled: !!session && !sessionPending,
    organizationsCount: organizations?.length 
  })
  
  // Only fetch subscription if user has completed onboarding
  const { data: subscription, isPending: subscriptionPending, fetchStatus: subscriptionFetchStatus } = useSubscription({
    enabled: !!session?.user?.onboardingCompleted && !sessionPending
  })
  console.log('[AuthenticatedLayout] Subscription state:', {
    subscription,
    subscriptionPending,
    subscriptionFetchStatus,
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
    console.log('[AuthenticatedLayout] useEffect running with:', {
      sessionPending,
      session: !!session,
      orgsPending,
      currentPath
    })
    
    // Handle unauthenticated users immediately (no need to wait for orgs)
    if (!sessionPending && !session) {
      console.log('[AuthenticatedLayout] No session, redirecting to signin')
      navigate({ to: '/auth/signin' })
      return
    }

    // For authenticated users, wait for both session and organizations
    if (!sessionPending && session && !orgsPending) {
      console.log('[AuthenticatedLayout] Session and orgs loaded, checking redirects')

      // Redirect incomplete onboarding users to onboarding (but not if already there)
      if (!session.user.onboardingCompleted && currentPath !== '/onboarding') {
        console.log('[AuthenticatedLayout] Onboarding incomplete, redirecting to onboarding')
        navigate({ to: '/onboarding' })
        return
      }

      // Check if user needs to select an organization
      // Skip this check for certain pages
      const skipOrgCheckPaths = ['/onboarding', '/select-organization', '/superadmin', '/payment-error', '/billing', '/choose-plan']
      const shouldSkipOrgCheck = skipOrgCheckPaths.some(path => currentPath.startsWith(path))
      console.log('[AuthenticatedLayout] Should skip org check?', shouldSkipOrgCheck, 'for path:', currentPath)
      
      if (!shouldSkipOrgCheck && session.user.onboardingCompleted) {
        const activeOrgId = getActiveOrganizationId()
        console.log('[AuthenticatedLayout] Active org ID:', activeOrgId, 'Organizations:', organizations)
        
        // If no active org ID or the active org doesn't exist in user's organizations
        if (!activeOrgId || (organizations && !organizations.find(org => org.id === activeOrgId))) {
          console.log('[AuthenticatedLayout] No valid active org, redirecting to select-organization')
          navigate({ to: '/select-organization' })
          return
        }

        // Check subscription status after onboarding is complete and org is selected
        if (!subscriptionPending) {
          const skipPaymentCheckPaths = ['/payment-error', '/billing', '/choose-plan']
          const shouldSkipPaymentCheck = skipPaymentCheckPaths.some(path => currentPath.startsWith(path))

          if (!shouldSkipPaymentCheck) {
            // Block access if no subscription data at all - redirect to plan selection
            if (!subscription) {
              navigate({ to: '/choose-plan' })
              return
            }

            const subscriptionStatus = subscription.subscription?.status
            const currentPlan = subscription.currentPlan
            
            // Block access if no active subscription
            // Allow access ONLY if subscription status is 'active' or 'trialing'
            const hasActiveSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
            
            if (!hasActiveSubscription || !currentPlan) {
              // If they have subscription data but it's inactive, send to payment error
              // If they have no subscription, send to choose plan
              if (subscription.subscription) {
                navigate({ to: '/payment-error' })
              } else {
                navigate({ to: '/choose-plan' })
              }
              return
            }
          }
        }
      }
    }
  }, [session, organizations, subscription, sessionPending, orgsPending, subscriptionPending, navigate, currentPath])

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
    console.log('[AuthenticatedLayout] Showing loading spinner:', {
      sessionPending,
      orgsPending,
      subscriptionPending,
      subscriptionFetchStatus,
      isSubscriptionActuallyLoading,
      onboardingCompleted: session?.user?.onboardingCompleted
    })
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
