import { useState } from 'react'
import { Users, AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/ui/button'
import { Switch } from '@/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Alert, AlertDescription } from '@/ui/alert'
import { Badge } from '@/ui/badge'
import type { MergedEmployee } from '../employee-sync.service'

interface EmployeeManagementListProps {
  employees: MergedEmployee[]
  onToggleEmployee: (employeeId: string, enabled: boolean) => Promise<void>
  onSyncEmployees?: () => Promise<void>
  showRemoved?: boolean
  readonly?: boolean
  isLoading?: boolean
  title?: string
  description?: string
  emptyMessage?: string
}

export function EmployeeManagementList({
  employees,
  onToggleEmployee,
  onSyncEmployees,
  showRemoved = false,
  readonly = false,
  isLoading = false,
  title = "Employee Management",
  description = "Manage which employees can receive bookings",
  emptyMessage = "No employees found"
}: EmployeeManagementListProps) {
  const [togglingEmployees, setTogglingEmployees] = useState<Set<string>>(new Set())

  // Filter employees based on showRemoved setting
  const displayEmployees = showRemoved 
    ? employees 
    : employees.filter(emp => !emp.isRemoved)

  const enabledCount = displayEmployees.filter(emp => emp.isEnabled && !emp.isRemoved).length
  const removedCount = employees.filter(emp => emp.isRemoved).length
  const newCount = employees.filter(emp => emp.wasJustAdded).length

  const handleToggle = async (employeeId: string, enabled: boolean) => {
    if (readonly) return
    
    setTogglingEmployees(prev => new Set([...prev, employeeId]))
    try {
      await onToggleEmployee(employeeId, enabled)
    } finally {
      setTogglingEmployees(prev => {
        const next = new Set(prev)
        next.delete(employeeId)
        return next
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          
          {onSyncEmployees && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncEmployees}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Sync from Provider
            </Button>
          )}
        </div>
        
        {/* Summary stats */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="secondary">
            {enabledCount} enabled for bookings
          </Badge>
          {removedCount > 0 && (
            <Badge variant="destructive">
              {removedCount} removed from provider
            </Badge>
          )}
          {newCount > 0 && (
            <Badge variant="success">
              {newCount} newly added
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Warnings for removed employees */}
        {removedCount > 0 && !showRemoved && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {removedCount} employee{removedCount > 1 ? 's have' : ' has'} been removed from your provider.
              Some may have been assigned to services.
            </AlertDescription>
          </Alert>
        )}

        {/* Employee list */}
        {displayEmployees.length > 0 ? (
          <div className="space-y-3">
            {displayEmployees.map((employee) => {
              const isToggling = togglingEmployees.has(employee.id)
              
              return (
                <div 
                  key={employee.id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    employee.isRemoved 
                      ? 'bg-muted border-destructive/20' 
                      : 'bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${employee.isRemoved ? 'text-muted-foreground line-through' : ''}`}>
                        {employee.name}
                      </p>
                      
                      {/* Status badges */}
                      <div className="flex gap-1">
                        {employee.isRemoved && (
                          <Badge variant="destructive" className="text-xs">
                            Removed
                          </Badge>
                        )}
                        {employee.wasJustAdded && (
                          <Badge variant="success" className="text-xs">
                            New
                          </Badge>
                        )}
                        {employee.wasJustRemoved && (
                          <Badge variant="destructive" className="text-xs">
                            Just Removed
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {employee.email && (
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                    )}
                    
                    {employee.lastSyncAt && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {employee.lastSyncAt.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground min-w-[120px] text-right">
                      {employee.isRemoved 
                        ? 'Removed from provider'
                        : employee.isEnabled 
                          ? 'Available for bookings' 
                          : 'Not available'
                      }
                    </span>
                    
                    <Switch
                      checked={employee.isEnabled && !employee.isRemoved}
                      onCheckedChange={(checked) => handleToggle(employee.id, checked)}
                      disabled={readonly || isToggling || employee.isRemoved}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        )}

        {/* Show removed employees toggle */}
        {removedCount > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // This would need to be handled by parent component
                // For now, just show message
              }}
              className="text-muted-foreground"
            >
              {showRemoved ? 'Hide' : 'Show'} {removedCount} removed employee{removedCount > 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}