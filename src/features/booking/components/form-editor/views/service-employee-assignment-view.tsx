import React, { useState } from "react";
import { useQuery } from '@tanstack/react-query'
import { Check, Users } from "lucide-react";
import { toast } from 'sonner'

import BackButton from "@/features/booking/components/form-editor/back-button";
import type { FlowNode } from "../form-flow-tree";
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Button } from '@/ui/button'
import { Switch } from '@/ui/switch'
import { Skeleton } from '@/ui/skeleton'
import { Badge } from '@/ui/badge'

interface ServiceEmployeeAssignmentViewProps {
    node: FlowNode;
    onNavigateBack: () => void;
    onUpdateNode: (nodeId: string, updates: Partial<FlowNode>) => void;
}

interface OrganizationEmployee {
    id: string
    simproEmployeeId: number
    simproEmployeeName: string
    simproEmployeeEmail?: string | null
    isActive: boolean
    displayOnSchedule: boolean
}

interface ServiceEmployee {
    id: string
    simproEmployeeId: number
    simproEmployeeName: string
    simproEmployeeEmail?: string | null
    displayOnSchedule: boolean
    isDefault: boolean
}

async function fetchOrganizationEmployees(organizationId: string): Promise<OrganizationEmployee[]> {
    const response = await fetch(`/api/employees?organizationId=${organizationId}`)
    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch employees')
    }
    return response.json()
}

export function ServiceEmployeeAssignmentView({
    node,
    onNavigateBack,
    onUpdateNode
}: ServiceEmployeeAssignmentViewProps) {
    const { activeOrganization } = useActiveOrganization()
    const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
    const [defaultEmployee, setDefaultEmployee] = useState<string | null>(null)
    
    // Initialize from node data
    React.useEffect(() => {
        if (node.assignedEmployeeIds) {
            setSelectedEmployees(new Set(node.assignedEmployeeIds))
        }
        if (node.defaultEmployeeId) {
            setDefaultEmployee(node.defaultEmployeeId)
        }
    }, [node.assignedEmployeeIds, node.defaultEmployeeId])

    // Fetch organization employees
    const { 
        data: orgEmployees = [], 
        isLoading: orgEmployeesLoading 
    } = useQuery({
        queryKey: ['employees', activeOrganization?.id],
        queryFn: () => activeOrganization ? fetchOrganizationEmployees(activeOrganization.id) : [],
        enabled: !!activeOrganization?.id,
    })




    const handleToggleEmployee = (employeeId: string) => {
        const newSelected = new Set(selectedEmployees)
        if (newSelected.has(employeeId)) {
            newSelected.delete(employeeId)
            // If this was the default employee, clear default
            if (defaultEmployee === employeeId) {
                setDefaultEmployee(null)
            }
        } else {
            newSelected.add(employeeId)
            // If this is the first employee selected, make it default
            if (newSelected.size === 1) {
                setDefaultEmployee(employeeId)
            }
        }
        setSelectedEmployees(newSelected)
    }

    const handleSetDefault = (employeeId: string) => {
        // Only allow setting default if employee is selected
        if (selectedEmployees.has(employeeId)) {
            setDefaultEmployee(employeeId)
        }
    }

    // Track if component has been initialized to avoid auto-save on mount
    const [isInitialized, setIsInitialized] = React.useState(false)
    
    // Auto-save when employees change (but not on initialization)
    React.useEffect(() => {
        if (isInitialized) {
            onUpdateNode(node.id, {
                assignedEmployeeIds: Array.from(selectedEmployees),
                defaultEmployeeId: defaultEmployee || undefined
            })
        }
    }, [selectedEmployees, defaultEmployee, node.id, onUpdateNode, isInitialized])
    
    // Mark as initialized after first render
    React.useEffect(() => {
        setIsInitialized(true)
    }, [])


    if (!node) return null

    return (
        <>
            <BackButton
                label="Service Options"
                onClick={onNavigateBack}
                className="self-start"
            />

            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold mb-2">Employee Assignment</h2>
                    <p className="text-muted-foreground">
                        Select which employees can perform the "{node.label}" service. 
                        Choose a default employee who will be pre-selected for new bookings.
                    </p>
                </div>


                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Available Employees
                        </CardTitle>
                        <CardDescription>
                            Select employees from your organization who can perform this service.
                            {orgEmployees.filter(emp => emp.isActive).length === 0 && (
                                <>
                                    {" "}No employees found. Please sync employees from Simpro in your settings first.
                                </>
                            )}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {orgEmployeesLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }, (_, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
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
                        ) : orgEmployees.filter(emp => emp.isActive).length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-2">No employees available</p>
                                <p className="text-sm">
                                    Sync employees from Simpro in your organization settings to assign them to services.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {orgEmployees
                                    .filter(emp => emp.isActive)
                                    .map((employee) => {
                                        const isSelected = selectedEmployees.has(employee.id)
                                        const isDefault = defaultEmployee === employee.id

                                        return (
                                            <div
                                                key={employee.id}
                                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
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
                                                        <div className="flex items-center space-x-2">
                                                            <p className="font-medium">{employee.simproEmployeeName}</p>
                                                            {isDefault && (
                                                                <Badge variant="secondary" className="text-xs">Default</Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                                            <span>ID: {employee.simproEmployeeId}</span>
                                                            {employee.simproEmployeeEmail && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>{employee.simproEmployeeEmail}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center space-x-3">
                                                    {isSelected && (
                                                        <Button
                                                            variant={isDefault ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={() => handleSetDefault(employee.id)}
                                                        >
                                                            {isDefault ? "Default" : "Set Default"}
                                                        </Button>
                                                    )}
                                                    <Switch
                                                        checked={isSelected}
                                                        onCheckedChange={() => handleToggleEmployee(employee.id)}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {selectedEmployees.size > 0 && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="font-medium">
                            {selectedEmployees.size} employee{selectedEmployees.size === 1 ? '' : 's'} selected
                        </p>
                        {defaultEmployee && (
                            <p className="text-sm text-muted-foreground">
                                {orgEmployees.find(emp => emp.id === defaultEmployee)?.simproEmployeeName} set as default
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            Changes are automatically saved
                        </p>
                    </div>
                )}
            </div>
        </>
    )
}

export default ServiceEmployeeAssignmentView;