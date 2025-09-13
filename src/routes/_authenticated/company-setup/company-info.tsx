import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { useSession, useListOrganizations } from '@/lib/auth/auth-hooks'
import { useErrorHandler } from '@/lib/errors/hooks'
import { CompanyInfoStep } from '@/features/onboarding/components/company-info-step'
import { completeOrganizationOnboarding } from '@/lib/providers/onboarding-setup.server'
import { 
  getOrganizationWithProviderData,
  refreshOrganizationFromProvider
} from '@/lib/providers/organization-data.server'
import { getActiveOrganizationId } from '@/features/organization/lib/organization-utils'

export const Route = createFileRoute('/_authenticated/company-setup/company-info')({
  staticData: {
    sidebar: false,
  },
  beforeLoad: () => {
    console.log('🔄 [DEBUG] company-info beforeLoad reached')
  },
  component: CompanyInfoPage,
})

function CompanyInfoPage() {
  console.log('🔄 [DEBUG] CompanyInfoPage component rendering')
  
  const { data: session } = useSession()
  const navigate = useNavigate()
  const { showError, showSuccess } = useErrorHandler()
  const { refetch: refetchOrganizations } = useListOrganizations()
  
  const [isLoading, setIsLoading] = useState(false)

  // Get active organization ID from client-side storage
  const activeOrgId = getActiveOrganizationId()
  
  console.log('🔄 [DEBUG] CompanyInfoPage activeOrgId:', activeOrgId)

  // Fetch organization data
  const { 
    data: orgData, 
    isLoading: dataLoading, 
    error: orgError,
    refetch: refetchOrgData
  } = useQuery({
    queryKey: ['organization-data', activeOrgId],
    queryFn: () => getOrganizationWithProviderData(),
    enabled: !!activeOrgId,
  }) as { 
    data: { organization: any } | undefined,
    isLoading: boolean,
    error: any,
    refetch: () => Promise<any>
  }

  // If no active organization, redirect to selection
  if (!activeOrgId) {
    return <Navigate to="/select-organization" />
  }

  // Show loading state while data is being fetched
  if (dataLoading) {
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
  if (orgError) {
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
    return <Navigate to="/select-organization" />
  }

  const organization = orgData.organization

  const handleContinue = async () => {
    // Validate address is present
    if (!organization.addressLine1) {
      showError(new Error('Business address is required to continue. Please add an address and refresh.'))
      return
    }

    setIsLoading(true)
    try {
      // Complete organization onboarding after company info validation
      await completeOrganizationOnboarding()
      
      // Refetch organization data so authenticated layout knows onboarding is complete
      await refetchOrganizations()
      
      showSuccess('Company information confirmed!')
      
      // Navigate to employee selection step (now optional)
      await navigate({ to: '/company-setup/employees' })
    } catch (error) {
      showError(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      // Refresh organization data from provider
      await refreshOrganizationFromProvider()
      
      // Refetch the data
      await refetchOrgData()
      
      showSuccess('Company information refreshed successfully!')
    } catch (error) {
      showError(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <CompanyInfoStep
      organization={{
        id: organization.id,
        name: organization.name,
        phone: organization.phone,
        email: organization.email,
        website: organization.website,
        currency: organization.currency,
        timezone: organization.timezone,
        addressLine1: organization.addressLine1,
        addressLine2: organization.addressLine2,
        addressCity: organization.addressCity,
        addressState: organization.addressState,
        addressPostalCode: organization.addressPostalCode,
        addressCountry: organization.addressCountry,
        providerType: organization.providerType,
        providerData: organization.providerData,
        providerCompanyId: organization.providerCompanyId,
      }}
      onContinue={handleContinue}
      onRefresh={handleRefresh}
      isLoading={isLoading}
    />
  )
}