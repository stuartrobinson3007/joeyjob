import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertCircle } from 'lucide-react'

import { useErrorHandler } from '@/lib/errors/hooks'
import { parseError, handleErrorAction } from '@/taali/errors/client-handler'
import { Button } from '@/taali/components/ui/button'
import { EmployeeSelectionStep } from '@/features/onboarding/components/employee-selection-step'
import { 
  getEmployeesForOrganization,
  syncEmployeesFromProvider,
  toggleEmployeeEnabled
} from '@/lib/employees/server'
import { getActiveOrganizationId } from '@/features/organization/lib/organization-utils'

export const Route = createFileRoute('/_all-pages/_authenticated/company-setup/employees')({
  staticData: {
    sidebar: false,
  },
  component: EmployeesPage,
})

function EmployeesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showError, showSuccess, translateError } = useErrorHandler()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<unknown>(null)

  // Get active organization ID from client-side storage
  const activeOrgId = getActiveOrganizationId()
  console.log('🔍 [EmployeesPage] Component mounted with activeOrgId:', activeOrgId)

  // Auto-sync employees when component mounts (during onboarding)
  useEffect(() => {
    if (!activeOrgId) return
    
    console.log('🔍 [EmployeesPage] Auto-syncing employees on mount...')
    setIsSyncing(true)
    
    syncEmployeesFromProvider({ data: {} })
      .then((result) => {
        console.log('🔍 [EmployeesPage] Initial sync completed:', result)
        // Invalidate the query to refetch with the new data
        queryClient.invalidateQueries({ queryKey: ['organization-employees'] })
      })
      .catch((error) => {
        console.error('🔍 [EmployeesPage] Initial sync failed:', error)
        setSyncError(error) // Store sync error for display
        // Still show toast for immediate feedback
        showError(error, { 
          fallbackMessage: 'Failed to sync employees from Simpro'
        })
      })
      .finally(() => {
        setIsSyncing(false)
      })
  }, [activeOrgId, queryClient])

  // Fetch employees using shared service
  const { 
    data: employeeData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['organization-employees'],
    queryFn: () => {
      console.log('🔍 [EmployeesPage] Fetching employees for organization...')
      return getEmployeesForOrganization()
    },
    enabled: !!activeOrgId,
  })

  console.log('🔍 [EmployeesPage] Query result:', {
    hasData: !!employeeData,
    employeeCount: employeeData?.employees?.length || 0,
    isLoading,
    isSyncing,
    queryError: error?.message || null,
    syncError: syncError ? 'Sync failed' : null
  })

  const employees = employeeData?.employees || []

  // If no active organization, redirect to selection
  if (!activeOrgId) {
    return <Navigate to="/select-organization" />
  }

  // Show loading state while data is being fetched or synced
  if (isLoading || isSyncing) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {isSyncing ? 'Syncing employees from Simpro...' : 'Loading employee information...'}
          </p>
        </div>
      </div>
    )
  }

  // Handle errors (both query errors and sync errors)
  const displayError = error || syncError
  if (displayError) {
    const parsedError = parseError(displayError)
    const isQueryError = !!error
    const isSyncError = !!syncError
    
    const handleRetry = async () => {
      setSyncError(null) // Clear sync error
      setIsSyncing(true) // Show syncing state
      
      try {
        // Re-trigger the sync
        const result = await syncEmployeesFromProvider()
        console.log('🔍 [EmployeesPage] Retry sync completed:', result)
        // Invalidate query to get fresh data
        queryClient.invalidateQueries({ queryKey: ['organization-employees'] })
      } catch (error) {
        console.error('🔍 [EmployeesPage] Retry sync failed:', error)
        setSyncError(error)
        showError(error, { 
          fallbackMessage: 'Failed to sync employees from Simpro'
        })
      } finally {
        setIsSyncing(false)
      }
    }
    
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="p-6 border border-destructive/30 rounded-lg bg-destructive/5">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive mb-2">
              {isSyncError ? 'Failed to Sync Employees' : 'Failed to Load Employees'}
            </h3>
            <p className="text-sm text-destructive mb-4">
              {translateError(parsedError)}
            </p>
            {parsedError.actions && parsedError.actions.length > 0 ? (
              <div className="space-y-2">
                {parsedError.actions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleErrorAction(action)}
                  >
                    {action.label || action.action}
                  </Button>
                ))}
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRetry}
              >
                Try Again
              </Button>
            )}
          </div>
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
    console.log('🔍 [EmployeesPage] Triggering employee sync from provider...')
    setSyncError(null) // Clear any existing sync error
    try {
      const result = await syncEmployeesFromProvider()
      console.log('🔍 [EmployeesPage] Sync completed:', result)
      showSuccess('Employee data refreshed from provider!')
    } catch (error) {
      console.error('🔍 [EmployeesPage] Sync failed:', error)
      setSyncError(error)
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