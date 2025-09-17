import { useState } from 'react'
import { AlertCircle, ExternalLink, AlertTriangle, ArrowLeft } from 'lucide-react'

import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Alert, AlertDescription } from '@/ui/alert'
import { ProviderUpdateModal } from './provider-update-modal'

interface CompanyInfoStepProps {
  organization: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
    website?: string | null
    currency?: string | null
    timezone: string
    addressLine1?: string | null
    addressLine2?: string | null
    addressCity?: string | null
    addressState?: string | null
    addressPostalCode?: string | null
    addressCountry?: string | null
    providerType?: string | null
    providerData?: any
    providerCompanyId?: string | null
  }
  onContinue: () => void
  onRefresh?: () => Promise<void>
  onBack?: () => void
  isLoading?: boolean
}

export function CompanyInfoStep({
  organization,
  onContinue,
  onRefresh,
  onBack,
  isLoading = false
}: CompanyInfoStepProps) {
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  const formatAddress = () => {
    const parts = [
      organization.addressLine1,
      organization.addressLine2,
      organization.addressCity,
      organization.addressState,
      organization.addressPostalCode,
      organization.addressCountry
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(', ') : null
  }

  const handleReportIssue = () => {
    setShowUpdateModal(true)
  }

  const isAddressValid = !!organization.addressLine1
  const providerDisplayName = organization.providerType === 'simpro' ? 'SimPro' : organization.providerType || 'your provider'
  const formattedAddress = formatAddress()

  return (
    <>
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center relative">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="absolute left-4 top-4"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <CardTitle className="text-2xl font-bold">Company Information</CardTitle>
            <CardDescription className="text-base">
              Let's confirm your business details from {providerDisplayName}.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Information Notice */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Make sure the following is correct. Update these settings in {providerDisplayName} if needed.
              </AlertDescription>
            </Alert>

            {/* Address Validation Alert */}
            {!isAddressValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  A business address is required to continue. Please add an address in {providerDisplayName} and refresh.
                </AlertDescription>
              </Alert>
            )}

            {/* Company Information */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Company Name</h3>
                <p className="text-base font-medium">{organization.name}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Business Address</h3>
                {isAddressValid ? (
                  <p className="text-base">{formattedAddress}</p>
                ) : (
                  <div className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-base">Missing</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Timezone</h3>
                  <p className="text-base">
                    {organization.timezone
                      ? organization.timezone.replace('_', ' ')
                      : 'Not specified'
                    }
                  </p>
                </div>

                {organization.currency && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Currency</h3>
                    <p className="text-base">{organization.currency}</p>
                  </div>
                )}
              </div>

              {/* Additional contact info if available */}
              {(organization.phone || organization.email || organization.website) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {organization.phone && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Phone</h3>
                      <p className="text-base">{organization.phone}</p>
                    </div>
                  )}
                  {organization.email && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Email</h3>
                      <p className="text-base">{organization.email}</p>
                    </div>
                  )}
                  {organization.website && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Website</h3>
                      <p className="text-base">
                        <a
                          href={organization.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                        >
                          {organization.website}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row-reverse gap-3 pt-4">
              {isAddressValid && (
                <Button
                  onClick={onContinue}
                  disabled={isLoading}
                  loading={isLoading}
                  className="flex-1"
                >
                  Continue to Employee Setup
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleReportIssue}
                disabled={isLoading}
                className="flex-1"
              >
                Refresh from Simpro
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Update Instructions Modal */}
      <ProviderUpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        providerType={organization.providerType || 'simpro'}
        organizationData={{
          providerData: organization.providerData,
          providerCompanyId: organization.providerCompanyId,
        }}
        onRefresh={onRefresh}
      />
    </>
  )
}