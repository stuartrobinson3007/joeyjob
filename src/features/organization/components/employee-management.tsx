import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Users, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Switch } from '@/ui/switch'
import { Skeleton } from '@/ui/skeleton'
import { Alert, AlertDescription } from '@/ui/alert'

interface OrganizationEmployee {
  id: string
  simproEmployeeId: number
  simproEmployeeName: string
  simproEmployeeEmail?: string | null
  isActive: boolean
  displayOnSchedule: boolean
  lastSyncAt: Date | null
  syncError?: string | null
}

async function fetchEmployees(organizationId: string): Promise<OrganizationEmployee[]> {
  const response = await fetch(`/api/employees?organizationId=${organizationId}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch employees')
  }
  return response.json()
}

async function syncEmployees(organizationId: string): Promise<{ success: boolean; syncedCount: number; newCount: number }> {
  const response = await fetch('/api/employees/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ organizationId }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to sync employees')
  }
  
  return response.json()
}

async function updateEmployeeStatus(organizationId: string, employeeId: string, isActive: boolean): Promise<void> {
  const response = await fetch('/api/employees', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ organizationId, employeeId, isActive }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update employee status')
  }
}

export function EmployeeManagement() {
  const { activeOrganization } = useActiveOrganization()
  const { t } = useTranslation('settings')
  const { showError, showSuccess } = useErrorHandler()
  const queryClient = useQueryClient()
  
  // Fetch employees
  const { 
    data: employees = [], 
    isLoading: employeesLoading, 
    error: employeesError 
  } = useQuery({
    queryKey: ['employees', activeOrganization?.id],
    queryFn: () => activeOrganization ? fetchEmployees(activeOrganization.id) : [],
    enabled: !!activeOrganization?.id,
  })

  // Sync employees mutation
  const syncMutation = useMutation({
    mutationFn: () => activeOrganization ? syncEmployees(activeOrganization.id) : Promise.reject('No organization'),
    onSuccess: (data) => {
      showSuccess(`Synced ${data.syncedCount} employees (${data.newCount} new)`)
      queryClient.invalidateQueries({ queryKey: ['employees', activeOrganization?.id] })
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : 'Failed to sync employees')
    },
  })

  // Update employee status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ employeeId, isActive }: { employeeId: string; isActive: boolean }) =>
      activeOrganization ? updateEmployeeStatus(activeOrganization.id, employeeId, isActive) : Promise.reject('No organization'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', activeOrganization?.id] })
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : 'Failed to update employee')
    },
  })

  const handleSyncEmployees = () => {
    syncMutation.mutate()
  }

  const handleToggleEmployee = (employeeId: string, currentStatus: boolean) => {
    updateStatusMutation.mutate({ employeeId, isActive: !currentStatus })
  }

  if (!activeOrganization) {
    return null
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Employee Management</CardTitle>
          </div>
          <Button
            onClick={handleSyncEmployees}
            disabled={syncMutation.isPending}
            variant="outline"
            size="sm"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync from Simpro
          </Button>
        </div>
        <CardDescription>
          Manage which employees from your Simpro system can be assigned to bookings.
          Sync with Simpro to fetch the latest employee list.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {employeesError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {employeesError instanceof Error ? employeesError.message : 'Failed to load employees'}
            </AlertDescription>
          </Alert>
        )}

        {employeesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No employees found</p>
            <p className="text-sm mb-4">
              Sync with Simpro to import your employee list and start assigning them to bookings.
            </p>
            <Button
              onClick={handleSyncEmployees}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync from Simpro
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {employee.simproEmployeeName.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    {employee.displayOnSchedule && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{employee.simproEmployeeName}</p>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>ID: {employee.simproEmployeeId}</span>
                      {employee.simproEmployeeEmail && (
                        <>
                          <span>•</span>
                          <span>{employee.simproEmployeeEmail}</span>
                        </>
                      )}
                      {employee.syncError && (
                        <>
                          <span>•</span>
                          <span className="text-destructive">Sync error</span>
                        </>
                      )}
                    </div>
                    {employee.lastSyncAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last synced: {new Date(employee.lastSyncAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {!employee.displayOnSchedule && (
                    <div className="flex items-center text-amber-600 text-sm">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span>Hidden in Simpro</span>
                    </div>
                  )}
                  <Switch
                    checked={employee.isActive}
                    onCheckedChange={() => handleToggleEmployee(employee.id, employee.isActive)}
                    disabled={updateStatusMutation.isPending}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {employees.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {employees.filter(e => e.isActive).length} of {employees.length} employees enabled
              </span>
              {employees.some(e => e.syncError) && (
                <span className="text-destructive flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Some employees have sync errors
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}