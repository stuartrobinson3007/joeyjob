import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Building2, Loader2, AlertCircle, ArrowRight } from 'lucide-react'

import { useSession } from '@/lib/auth/auth-hooks'
import { useErrorHandler } from '@/lib/errors/hooks'
import { parseError, handleErrorAction } from '@/taali/errors/client-handler'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Button } from '@/ui/button'
import { Card, CardContent } from '@/ui/card'
import { Alert, AlertDescription } from '@/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group'
import { Label } from '@/ui/label'
import { Badge } from '@/ui/badge'

import { getAvailableSimproCompanies, checkExistingOrganization } from '@/lib/simpro/company-connection.service'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/taali/lib/utils'

export const Route = createFileRoute('/_authenticated/company-setup/select-company')({
  staticData: {
    sidebar: false,
    skipOrgCheck: true, // Company setup doesn't require existing organization
  },
  component: SelectCompanyPage,
})

interface SimproCompany {
  id: string
  name: string
  address?: {
    line1?: string
    city?: string
    state?: string
    country?: string
  }
  phone?: string
  email?: string
}

function SelectCompanyPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { showError } = useErrorHandler()
  const { t } = useTranslation('onboarding')

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [isContinuing, setIsContinuing] = useState(false)
  const [existingOrgs, setExistingOrgs] = useState<Set<string>>(new Set())

  // Fetch available Simpro companies
  const {
    data: companiesData,
    isLoading,
    error: companiesError,
    refetch: refetchCompanies
  } = useQuery({
    queryKey: ['simpro-companies'],
    queryFn: () => getAvailableSimproCompanies(),
  })

  const companies = companiesData?.companies || []
  
  console.log('🔍 [SelectCompany] Companies data received:', {
    hasData: !!companiesData,
    companiesCount: companies.length,
    firstCompany: companies[0] || null,
    firstCompanyAddress: companies[0]?.address || null
  })

  // Check which companies are already connected
  const checkExistingOrganizations = async () => {
    if (companies.length === 0) return

    const existing = new Set<string>()
    for (const company of companies) {
      try {
        const result = await checkExistingOrganization({ data: { companyId: company.id } })
        if (result.exists) {
          existing.add(company.id)
        }
      } catch (error) {
        console.warn('Failed to check existing organization for company:', company.id)
      }
    }
    setExistingOrgs(existing)
  }

  // Auto-select first available company
  const selectFirstAvailable = () => {
    const availableCompanies = companies.filter(c => !existingOrgs.has(c.id))
    if (availableCompanies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(availableCompanies[0].id)
    }
  }

  // Check existing orgs when companies load
  useEffect(() => {
    if (companies.length > 0) {
      checkExistingOrganizations()
    }
  }, [companies.length])

  // Auto-select when existing orgs are loaded
  useEffect(() => {
    if (companies.length > 0 && existingOrgs.size >= 0) {
      selectFirstAvailable()
    }
  }, [companies.length, existingOrgs.size])

  const handleContinue = async () => {
    if (!selectedCompanyId) {
      showError('Please select a company to continue')
      return
    }

    const selectedCompany = companies.find(c => c.id === selectedCompanyId)
    if (!selectedCompany) {
      showError('Selected company not found')
      return
    }

    setIsContinuing(true)

    try {
      // Store selected company in session storage for next step
      sessionStorage.setItem('selected_simpro_company', JSON.stringify(selectedCompany))

      // Navigate to company-info page to confirm details
      await navigate({ to: '/company-setup/company-info' })
    } catch (error) {
      showError(error)
      setIsContinuing(false)
    }
  }

  const handleRetry = () => {
    refetchCompanies()
  }

  const handleManualSetup = () => {
    // Clear any stored company data and go to manual setup
    sessionStorage.removeItem('selected_simpro_company')
    navigate({ to: '/company-setup/company-info' })
  }

  // Check if all companies are already connected
  const availableCompanies = companies.filter(c => !existingOrgs.has(c.id))
  const allConnected = companies.length > 0 && availableCompanies.length === 0

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
        <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-2xl">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-semibold mb-2">Connecting to Simpro</h2>
            <p className="text-muted-foreground">
              Fetching your available companies...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (allConnected) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
        <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-2xl">
          <div className="text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-success" />
            <h2 className="text-xl font-semibold mb-2">All Companies Connected</h2>
            <p className="text-muted-foreground mb-6">
              You've already connected all available Simpro companies to JoeyJob.
            </p>

            <div className="space-y-3 mb-6">
              {companies.map(company => (
                <div key={company.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="text-sm text-muted-foreground text-left">
                      {company.address && [
                        company.address.line1,
                        company.address.line2,
                        company.address.city,
                        company.address.state,
                        company.address.country
                      ].filter(item => item && typeof item === 'string' && item.trim() !== '').join(', ')}
                    </p>
                  </div>
                  <Badge variant="success" appearance="soft">
                    Connected
                  </Badge>
                </div>
              ))}
            </div>

            <Button onClick={() => navigate({ to: '/select-organization' })}>
              Back to Organizations
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (companiesError) {
    const parsedError = parseError(companiesError)

    return (
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
        <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-2xl">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Connection Failed</h2>
            <p className="text-muted-foreground mb-6">{parsedError.message}</p>

            {/* Show error actions if available, otherwise default actions */}
            <div className="space-x-3">
              {parsedError.actions && parsedError.actions.length > 0 ? (
                parsedError.actions.map((action, index) => (
                  <Button
                    key={index}
                    onClick={() => handleErrorAction(action)}
                    variant={action.action === 'updateConnection' ? 'default' : 'outline'}
                  >
                    {action.label || action.action}
                  </Button>
                ))
              ) : (
                <>
                  <Button onClick={handleRetry}>
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={handleManualSetup}>
                    Manual Setup
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
        <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-2xl">
          <div className="text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No Companies Found</h2>
            <p className="text-muted-foreground mb-6">
              Your Simpro account doesn't have access to any companies, or they're not visible to your user role.
            </p>

            <Alert className="text-left mb-6">
              <AlertDescription>
                <strong>Need help?</strong> Contact your Simpro administrator to:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Grant company access to your user account</li>
                  <li>Verify your user permissions in Simpro</li>
                  <li>Check if companies are properly configured</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-x-3">
              <Button onClick={handleRetry}>
                Check Again
              </Button>
              <Button variant="outline" onClick={handleManualSetup}>
                Manual Setup
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
      <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-2xl">
        <div className="text-center mb-8">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold mb-2">Select Your Company</h1>
          <p className="text-muted-foreground">
            Choose which Simpro company to connect to JoeyJob
          </p>
        </div>

        <div className="space-y-4">
          <RadioGroup
            value={selectedCompanyId}
            onValueChange={setSelectedCompanyId}
            className="space-y-3"
          >
            {companies.map((company) => {

              // ADDRESS NOT CORRECT HERE

              const isConnected = existingOrgs.has(company.id)

              return (
                <div
                  key={company.id}
                  className={cn(
                    "flex items-start gap-4 rounded-lg border-2 p-4 transition-all",
                    isConnected
                      ? "opacity-60 bg-muted border-muted"
                      : "hover:bg-accent hover:border-accent-foreground/20 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  )}
                >
                  <RadioGroupItem
                    value={company.id}
                    id={company.id}
                    className="mt-1"
                    disabled={isConnected}
                  />
                  <Label
                    htmlFor={company.id}
                    className={cn(
                      "flex-1",
                      isConnected ? "cursor-not-allowed" : "cursor-pointer"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-foreground">{company.name}</h3>
                        <div className="flex gap-2">
                          {existingOrgs.has(company.id) && (
                            <Badge variant="success" className="text-xs">
                              Already Connected
                            </Badge>
                          )}
                        </div>
                      </div>

                      {company.address && (
                        <p className="text-sm text-muted-foreground text-left">
                          {(() => {
                            const addressParts = [
                              company.address.line1,
                              company.address.line2,
                              company.address.city,
                              company.address.state,
                              company.address.country
                            ];
                            const filteredParts = addressParts.filter(item => {
                              if (item === null || item === undefined) return false;
                              if (typeof item !== 'string') return false;
                              if (item.trim().length === 0) return false;
                              console.log('🔍 [SelectCompany] Filter check - INCLUDED:', { item, type: typeof item });
                              return true;
                            });
                            console.log('🔍 [SelectCompany] Address debug for company', company.id, ':', {
                              rawAddress: company.address,
                              addressParts,
                              filteredParts,
                              finalDisplay: filteredParts.join(', ')
                            });
                            const result = filteredParts.join(', ');
                            console.log('🔍 [SelectCompany] FINAL RETURN VALUE:', result);
                            console.log('🔍 [SelectCompany] React will render:', JSON.stringify(result));
                            return result;
                          })()}
                        </p>
                      )}
                      
                      {/* Debug fallback to test rendering */}
                      <p className="text-xs text-red-500">
                        DEBUG: Address exists: {company.address ? 'YES' : 'NO'} 
                        | Raw: {JSON.stringify(company.address)}
                      </p>

                      {company.phone && (
                        <p className="text-sm text-muted-foreground">
                          {company.phone}
                        </p>
                      )}
                    </div>
                  </Label>
                </div>
              )
            })}
          </RadioGroup>

          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/select-organization' })}
            >
              Cancel
            </Button>

            <Button
              onClick={handleContinue}
              disabled={!selectedCompanyId || isContinuing}
            >
              {isContinuing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Continuing...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}