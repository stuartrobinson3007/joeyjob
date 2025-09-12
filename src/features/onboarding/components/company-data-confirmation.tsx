import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Alert, AlertDescription } from '@/ui/alert'
import type { CompanyInfo, Employee } from '@/lib/providers/provider-info.interface'
import { ProviderUpdateModal } from './provider-update-modal'

interface CompanyDataConfirmationProps {
  organization: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
    website?: string | null
    currency?: string | null
    timezone: string
    addressStreet?: string | null
    addressCity?: string | null
    addressState?: string | null
    addressPostalCode?: string | null
    addressCountry?: string | null
    providerType?: string | null
  }
  employees: Employee[]
  onConfirm: () => void
  onReportIssue: () => void
  onRefresh?: () => Promise<void>
  isLoading?: boolean
}

export function CompanyDataConfirmation({ 
  organization, 
  employees, 
  onConfirm, 
  onReportIssue,
  onRefresh,
  isLoading = false 
}: CompanyDataConfirmationProps) {
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  const formatAddress = () => {
    const parts = [
      organization.addressStreet,
      organization.addressCity,
      organization.addressState,
      organization.addressPostalCode,
      organization.addressCountry
    ].filter(Boolean)
    
    return parts.length > 0 ? parts.join(', ') : 'No address provided'
  }

  const handleReportIssue = () => {
    setShowUpdateModal(true)
    onReportIssue()
  }

  const providerDisplayName = organization.providerType === 'simpro' ? 'SimPro' : organization.providerType || 'your provider'

  return (
    <>
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome to JoeyJob!</CardTitle>
            <CardDescription className="text-base">
              Let's get started with your business details.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Information Notice */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Make sure the following is correct and update these settings in {providerDisplayName} if you need to.
              </AlertDescription>
            </Alert>

            {/* Company Information */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Company</h3>
                <p className="text-base">{organization.name}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Address</h3>
                <p className="text-base">{formatAddress()}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Timezone</h3>
                <p className="text-base">
                  {organization.timezone 
                    ? organization.timezone.replace('_', ' ') 
                    : 'Not specified'
                  }
                </p>
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
                      <p className="text-base">{organization.website}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Employees */}
              {employees.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Employees</h3>
                  <div className="space-y-1">
                    {employees.slice(0, 5).map((employee) => (
                      <p key={employee.id} className="text-base">
                        {employee.name}
                        {employee.email && (
                          <span className="text-muted-foreground ml-2">({employee.email})</span>
                        )}
                      </p>
                    ))}
                    {employees.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        ...and {employees.length - 5} more employees
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={onConfirm} 
                disabled={isLoading}
                loading={isLoading}
                className="flex-1"
              >
                Yes, this is all correct
              </Button>
              <Button 
                variant="outline" 
                onClick={handleReportIssue}
                disabled={isLoading}
                className="flex-1"
              >
                No, something is wrong
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
        onRefresh={onRefresh}
      />
    </>
  )
}