import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Building2 } from 'lucide-react'

import { useSession, useListOrganizations } from '@/lib/auth/auth-hooks'
import { useErrorHandler } from '@/lib/errors/hooks'
import { CompanyInfoStep } from '@/features/onboarding/components/company-info-step'
import { Button } from '@/ui/button'
// Organization onboarding completion removed - organizations are ready immediately
import { 
  getOrganizationWithProviderData,
  refreshOrganizationFromProvider
} from '@/lib/providers/organization-data.server'
import { getActiveOrganizationId, setActiveOrganizationId } from '@/features/organization/lib/organization-utils'
import { createOrganizationFromSimproCompany } from '@/lib/simpro/company-connection.service'
import { authClient } from '@/lib/auth/auth-client'

export const Route = createFileRoute('/_all-pages/_authenticated/company-setup/company-info')({
  staticData: {
    sidebar: false,
    skipOrgCheck: true, // May not have organization yet during setup
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
  const [isCreatingFromSimpro, setIsCreatingFromSimpro] = useState(false)

  // Check for selected Simpro company from previous step
  const selectedSimproCompany = (() => {
    try {
      const stored = sessionStorage.getItem('selected_simpro_company')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })()

  // Get active organization ID from client-side storage (for existing org editing)
  const activeOrgId = getActiveOrganizationId()
  
  console.log('🔄 [DEBUG] CompanyInfoPage state:', {
    activeOrgId,
    hasSelectedCompany: !!selectedSimproCompany,
    selectedCompany: selectedSimproCompany
  })

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

  // For existing organizations, we can get build config from the org data
  // For new organizations, we get it from sessionStorage

  // Handle different scenarios:
  // 1. Editing existing organization (has activeOrgId)
  // 2. Creating new organization from Simpro (has selectedSimproCompany)
  if (!activeOrgId && !selectedSimproCompany) {
    return <Navigate to="/select-organization" />
  }

  // Show loading state while data is being fetched (only for existing orgs)
  if (activeOrgId && dataLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading company information...</p>
        </div>
      </div>
    )
  }

  // Handle errors (only for existing orgs)
  if (activeOrgId && orgError) {
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

  // Determine data source: existing organization or selected Simpro company
  let organization
  let isNewOrganization = false

  if (activeOrgId && orgData?.organization) {
    // Editing existing organization
    organization = orgData.organization
  } else if (selectedSimproCompany) {
    // Creating new organization from Simpro data
    organization = {
      id: null, // Will be created
      name: selectedSimproCompany.name,
      phone: selectedSimproCompany.phone,
      email: selectedSimproCompany.email,
      website: null,
      currency: null,
      timezone: selectedSimproCompany.timezone, // Use Simpro timezone
      addressLine1: selectedSimproCompany.address?.line1,
      addressLine2: selectedSimproCompany.address?.line2,
      addressCity: selectedSimproCompany.address?.city,
      addressState: selectedSimproCompany.address?.state,
      addressPostalCode: selectedSimproCompany.address?.postalCode,
      addressCountry: selectedSimproCompany.address?.country,
      providerType: 'simpro',
      providerCompanyId: selectedSimproCompany.id,
    }
    isNewOrganization = true
  } else {
    // Fallback - no data available
    return <Navigate to="/select-organization" />
  }

  // Check if we have build config available for Simpro organizations
  const hasSessionConfig = (() => {
    try {
      return !!sessionStorage.getItem('simpro_build_config')
    } catch {
      return false
    }
  })()

  // Get build config for existing organizations or from session storage for new ones
  const getBuildConfig = () => {
    if (hasSessionConfig) {
      try {
        return JSON.parse(sessionStorage.getItem('simpro_build_config') || '{}')
      } catch {
        return null
      }
    }
    return null
  }

  const buildConfig = getBuildConfig()
  const needsBuildConfig = organization.providerType === 'simpro'
  const canRefresh = hasSessionConfig || !isNewOrganization

  // Show re-authentication screen if Simpro org but no way to get build config
  if (needsBuildConfig && !canRefresh) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
        <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-warning" />
            <h2 className="text-xl font-semibold mb-2">Build Configuration Missing</h2>
            <p className="text-muted-foreground mb-6">
              To refresh company data and access Simpro settings, please log in again to set your build configuration.
            </p>
            
            <Button 
              onClick={async () => {
                await authClient.signOut()
                navigate({ to: '/auth/signin' })
              }}
              className="w-full"
            >
              Log Out & Sign In Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const handleContinue = async () => {
    setIsLoading(true)
    try {
      if (isNewOrganization && selectedSimproCompany) {
        // Create new organization from Simpro company
        setIsCreatingFromSimpro(true)
        
        const result = await createOrganizationFromSimproCompany({ 
          data: { company: selectedSimproCompany } 
        })
        
        if (result.success) {
          // Clear stored company data
          sessionStorage.removeItem('selected_simpro_company')
          
          // Set the new organization as active
          setActiveOrganizationId(result.organizationId)
          
          // Refetch organizations
          await refetchOrganizations()
          
          showSuccess(`${result.organizationName} connected successfully!`)
          
          // Navigate to employee selection
          await navigate({ to: '/company-setup/employees' })
        }
      } else {
        // Existing organization - validate and continue
        if (!organization.addressLine1) {
          showError(new Error('Business address is required to continue. Please add an address and refresh.'))
          return
        }

        // Organization is ready to use immediately - no completion needed
        // Refetch organization data
        await refetchOrganizations()
        
        showSuccess('Company information confirmed!')
        
        // Navigate to employee selection
        await navigate({ to: '/company-setup/employees' })
      }
    } catch (error) {
      showError(error)
    } finally {
      setIsLoading(false)
      setIsCreatingFromSimpro(false)
    }
  }

  const handleRefresh = async () => {
    
    setIsLoading(true)
    try {
      if (isNewOrganization) {
        // For new organizations, re-fetch the company data from Simpro using the service
        if (!hasSessionConfig) {
          throw new Error('Build configuration missing - cannot refresh company data')
        }
        
        // Re-fetch companies and update the selected company data
        const { getAvailableSimproCompanies } = await import('@/lib/simpro/company-connection.service')
        const companiesData = await getAvailableSimproCompanies()
        
        
        // Find the current company in the fresh data and update session storage
        const currentCompany = companiesData.companies.find(c => c.id === selectedSimproCompany?.id)
        if (currentCompany) {
          sessionStorage.setItem('selected_simpro_company', JSON.stringify(currentCompany))
          
          // Force page refresh to show updated data
          window.location.reload()
        } else {
          throw new Error('Company not found in refreshed data')
        }
      } else {
        // For existing organizations, refresh from provider
        await refreshOrganizationFromProvider()
        
        // Refetch the data
        await refetchOrgData()
        
        showSuccess('Company information refreshed successfully!')
      }
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
        providerData: buildConfig ? { simpro: buildConfig } : null,
        providerCompanyId: organization.providerCompanyId,
      }}
      onContinue={handleContinue}
      onRefresh={handleRefresh}
      onBack={() => navigate({ to: '/select-organization' })}
      isLoading={isLoading || isCreatingFromSimpro}
    />
  )
}