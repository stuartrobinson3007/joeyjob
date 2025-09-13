import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { useErrorHandler } from '@/lib/errors/hooks'
import { EmployeeSelectionStep } from '@/features/onboarding/components/employee-selection-step'
import { 
  getEmployeesForOrganization,
  syncEmployeesFromProvider,
  toggleEmployeeEnabled
} from '@/lib/employees/server'
import { getActiveOrganizationId } from '@/features/organization/lib/organization-utils'

export const Route = createFileRoute('/_authenticated/company-setup/employees')({
  staticData: {
    sidebar: false,
  },
  component: EmployeesPage,
})

function EmployeesPage() {
  const navigate = useNavigate()
  const { showError, showSuccess } = useErrorHandler()
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get active organization ID from client-side storage
  const activeOrgId = getActiveOrganizationId()

  // Fetch employees using shared service
  const { 
    data: employeeData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['organization-employees'],
    queryFn: () => getEmployeesForOrganization(),
    enabled: !!activeOrgId,
  })

  const employees = employeeData?.employees || []

  // If no active organization, redirect to selection
  if (!activeOrgId) {
    return <Navigate to="/select-organization" />
  }

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading employee information...</p>
        </div>
      </div>
    )
  }

  // Handle errors
  if (error) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Error loading employee data</p>
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

  const handleComplete = async () => {
    setIsSubmitting(true)
    try {
      // Save employee selections (TODO: implement employee selection saving)
      
      showSuccess('Employee setup completed!')
      
      // Navigate to dashboard (onboarding already completed in Step 1)
      await navigate({ to: '/' })
    } catch (error) {
      showError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = async () => {
    setIsSubmitting(true)
    try {
      showSuccess('You can set up employees later in Settings.')
      
      // Navigate to dashboard (onboarding already completed in Step 1)
      await navigate({ to: '/' })
    } catch (error) {
      showError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (employeeId: string, enabled: boolean) => {
    try {
      await toggleEmployeeEnabled({ employeeId, enabled })
    } catch (error) {
      showError(error)
    }
  }

  const handleRefresh = async () => {
    try {
      await syncEmployeesFromProvider()
      showSuccess('Employee data refreshed from provider!')
    } catch (error) {
      showError(error)
    }
  }

  return (
    <EmployeeSelectionStep
      organization={{
        id: activeOrgId,
        name: 'Company', // We don't need the full org data for this step
        providerType: 'simpro', // Default for now
      }}
      employees={employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        isActive: emp.isEnabled && !emp.isRemoved,
        metadata: {
          simproId: emp.simproEmployeeId,
          isRemoved: emp.isRemoved,
        }
      }))}
      onComplete={handleComplete}
      onSkip={handleSkip}
      onRefresh={handleRefresh}
      isLoading={isSubmitting}
    />
  )
}