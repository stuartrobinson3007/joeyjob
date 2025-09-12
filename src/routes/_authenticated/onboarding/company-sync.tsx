import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { useSession } from '@/lib/auth/auth-hooks'
import { useErrorHandler } from '@/lib/errors/hooks'
import { CompanyDataConfirmation } from '@/features/onboarding/components'
import { completeOrganizationOnboarding } from '@/lib/providers/onboarding-setup.server'
import { 
  getOrganizationWithProviderData,
  getOrganizationEmployees,
  refreshOrganizationFromProvider
} from '@/lib/providers/organization-data.server'
import { getActiveOrganizationId } from '@/features/organization/lib/organization-utils'

export const Route = createFileRoute('/_authenticated/onboarding/company-sync')({
  staticData: {
    sidebar: false,
  },
  beforeLoad: () => {
    console.log('🔄 [DEBUG] Company sync beforeLoad - no special requirements, just inherits auth from parent')
    // No additional requirements - just inherits authentication from /_authenticated
    // This route handles organization selection itself
  },
  component: CompanySyncPage,
})

function CompanySyncPage() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const { showError, showSuccess } = useErrorHandler()
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get active organization ID from client-side storage
  const activeOrgId = getActiveOrganizationId()
  
  console.log('🔄 [DEBUG] CompanySyncPage - Active organization ID:', activeOrgId)

  // Fetch organization data
  const { 
    data: orgData, 
    isLoading: orgLoading, 
    error: orgError 
  } = useQuery({
    queryKey: ['organization-data', activeOrgId],
    queryFn: () => {
      console.log('🚀 [DEBUG] Fetching organization data for:', activeOrgId)
      return getOrganizationWithProviderData({ organizationId: activeOrgId })
    },
    enabled: !!activeOrgId,
  })

  // Fetch employees data
  const { 
    data: employeesData, 
    isLoading: employeesLoading, 
    error: employeesError 
  } = useQuery({
    queryKey: ['organization-employees', activeOrgId],
    queryFn: () => {
      console.log('🚀 [DEBUG] Fetching employees for:', activeOrgId)
      return getOrganizationEmployees({ organizationId: activeOrgId })
    },
    enabled: !!activeOrgId,
  })

  console.log('🔄 [DEBUG] Data loading state:', {
    activeOrgId,
    orgLoading,
    employeesLoading,
    hasOrgData: !!orgData,
    hasEmployeesData: !!employeesData,
    orgError: orgError?.message,
    employeesError: employeesError?.message
  })

  // If no active organization, redirect to selection
  if (!activeOrgId) {
    console.log('❌ [DEBUG] No active organization ID, redirecting to select-organization')
    return <Navigate to="/select-organization" />
  }

  // Show loading state while data is being fetched
  const isLoading = orgLoading || employeesLoading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading company information...</p>
        </div>
      </div>
    )
  }

  // Handle errors
  if (orgError || employeesError) {
    console.error('❌ [DEBUG] Data loading error:', { orgError, employeesError })
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Error loading company data</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-primary underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // If no organization data after loading, something went wrong
  if (!orgData?.organization) {
    console.log('❌ [DEBUG] No organization data after loading')
    return <Navigate to="/select-organization" />
  }

  const organization = orgData.organization
  const employees = employeesData?.employees || []

  const handleConfirm = async () => {
    if (!organization) return

    setIsSubmitting(true)
    try {
      console.log('🚀 [DEBUG] Completing organization onboarding for:', organization.id)
      
      // Mark current organization as onboarding complete
      await completeOrganizationOnboarding({ organizationId: organization.id })
      
      console.log('✅ [DEBUG] Organization onboarding completed successfully')
      showSuccess('Organization setup completed!')
      
      // Navigate to dashboard
      await navigate({ to: '/' })
    } catch (error) {
      console.error('❌ [DEBUG] Error completing organization onboarding:', error)
      showError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReportIssue = () => {
    console.log('🔄 [DEBUG] User reported issue with company data')
    // Just show the modal - handled by the component
  }

  const handleRefresh = async () => {
    if (!organization) return
    
    try {
      console.log('🚀 [DEBUG] Refreshing organization data for:', organization.id)
      
      // Refresh organization data from provider
      await refreshOrganizationFromProvider({ organizationId: organization.id })
      
      console.log('✅ [DEBUG] Organization data refreshed, reloading page')
      // Reload the page to get fresh data
      window.location.reload()
    } catch (error) {
      console.error('❌ [DEBUG] Error refreshing organization data:', error)
      showError(error)
    }
  }

  return (
    <CompanyDataConfirmation
      organization={{
        id: organization.id,
        name: organization.name,
        phone: organization.phone,
        email: organization.email,
        website: organization.website,
        currency: organization.currency,
        timezone: organization.timezone,
        addressStreet: organization.addressStreet,
        addressCity: organization.addressCity,
        addressState: organization.addressState,
        addressPostalCode: organization.addressPostalCode,
        addressCountry: organization.addressCountry,
        providerType: organization.providerType,
      }}
      employees={employees}
      onConfirm={handleConfirm}
      onReportIssue={handleReportIssue}
      onRefresh={handleRefresh}
      isLoading={isSubmitting}
    />
  )
}