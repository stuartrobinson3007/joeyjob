import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useErrorHandler } from '@/lib/errors/hooks'
import { EmployeeManagementList } from '@/lib/employees'
import { 
  getEmployeesForOrganization, 
  syncEmployeesFromProvider, 
  toggleEmployeeEnabled 
} from '@/lib/employees/server'

export function EmployeeManagement() {
  const [showRemoved, setShowRemoved] = useState(false)
  const { showError, showSuccess } = useErrorHandler()
  const queryClient = useQueryClient()

  // Query for fetching employees
  const { data: employeeData, isLoading, error } = useQuery({
    queryKey: ['organization-employees'],
    queryFn: () => getEmployeesForOrganization(),
  })

  const employees = employeeData?.employees || []

  // Mutation for syncing employees from provider
  const syncMutation = useMutation({
    mutationFn: () => syncEmployeesFromProvider(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-employees'] })
      showSuccess('Employees synced successfully from provider')
    },
    onError: (error) => {
      showError(error)
    },
  })

  // Mutation for toggling employee enabled status
  const toggleMutation = useMutation({
    mutationFn: ({ employeeId, enabled }: { employeeId: string; enabled: boolean }) => 
      toggleEmployeeEnabled({ data: { employeeId, enabled } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-employees'] })
      showSuccess('Employee status updated')
    },
    onError: (error) => {
      showError(error)
    },
  })

  const handleSync = async () => {
    syncMutation.mutate()
  }

  const handleToggle = async (employeeId: string, enabled: boolean) => {
    toggleMutation.mutate({ employeeId, enabled })
  }

  if (error) {
    return (
      <EmployeeManagementList
        employees={[]}
        onToggleEmployee={handleToggle}
        onSyncEmployees={handleSync}
        showRemoved={showRemoved}
        title="Employee Management"
        description="Error loading employees. Try syncing from your provider."
        emptyMessage="Failed to load employees"
      />
    )
  }

  return (
    <EmployeeManagementList
      employees={employees}
      onToggleEmployee={handleToggle}
      onSyncEmployees={handleSync}
      showRemoved={showRemoved}
      isLoading={isLoading || syncMutation.isPending || toggleMutation.isPending}
      title="Employee Management"
      description="Manage which employees from your provider can receive bookings"
      emptyMessage="No employees found. Try syncing from your provider."
    />
  )
}