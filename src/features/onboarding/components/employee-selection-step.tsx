import { useState } from 'react'
import { Users, ArrowRight, SkipForward } from 'lucide-react'

import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Switch } from '@/ui/switch'
import { ProviderUpdateModal } from './provider-update-modal'
import type { Employee } from '@/lib/providers/provider-info.interface'

interface EmployeeSelectionStepProps {
  organization: {
    id: string
    name: string
    providerType?: string | null
    providerData?: any
    providerCompanyId?: string | null
  }
  employees: Employee[]
  onComplete: () => void
  onSkip: () => void
  onRefresh?: () => Promise<void>
  isLoading?: boolean
}

export function EmployeeSelectionStep({ 
  organization, 
  employees,
  onComplete,
  onSkip,
  onRefresh,
  isLoading = false 
}: EmployeeSelectionStepProps) {
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
    new Set(employees.filter(emp => emp.isActive).map(emp => emp.id.toString()))
  )

  const handleEmployeeToggle = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees)
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId)
    } else {
      newSelected.add(employeeId)
    }
    setSelectedEmployees(newSelected)
  }

  const handleComplete = async () => {
    // Here we would save the employee selections
    // For now, just complete the onboarding
    onComplete()
  }

  const handleReportIssue = () => {
    setShowUpdateModal(true)
  }

  const providerDisplayName = organization.providerType === 'simpro' ? 'SimPro' : organization.providerType || 'your provider'

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Employee Setup</CardTitle>
          <CardDescription className="text-base">
            Select which employees from {providerDisplayName} can receive bookings.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                ✓
              </div>
              <span className="ml-2">Company Info</span>
            </div>
            <ArrowRight className="h-4 w-4" />
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                2
              </div>
              <span className="ml-2">Employee Setup</span>
            </div>
          </div>

          {/* Employee List */}
          {employees.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-medium">
                  Select employees ({selectedEmployees.size} of {employees.length} selected)
                </h3>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {employees.map((employee) => {
                  const employeeId = employee.id.toString()
                  const isSelected = selectedEmployees.has(employeeId)
                  
                  return (
                    <div 
                      key={employeeId}
                      className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{employee.name}</p>
                        {employee.email && (
                          <p className="text-sm text-muted-foreground">{employee.email}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {isSelected ? 'Available for bookings' : 'Not available'}
                        </span>
                        <Switch
                          checked={isSelected}
                          onCheckedChange={() => handleEmployeeToggle(employeeId)}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No employees found in {providerDisplayName}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6">
            <Button 
              onClick={handleComplete} 
              disabled={isLoading}
              loading={isLoading}
              className="flex-1"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Complete Setup
            </Button>
            <Button 
              variant="outline" 
              onClick={onSkip}
              disabled={isLoading}
              className="flex-1"
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Skip for Now
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            You can always change employee availability later in Settings
          </p>
        </CardContent>
      </Card>

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
    </div>
  )
}