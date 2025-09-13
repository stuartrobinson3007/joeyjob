import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery } from '@tanstack/react-query'
import { Users, GripVertical } from "lucide-react";
import { getEmployeesForOrganization } from '@/lib/employees/server'
import type { MergedEmployee } from '@/lib/employees/employee-sync.service'

import { TitleWithBack } from "../components/title-with-back";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";

import FormEditorBreadcrumb from "@/features/booking/components/form-editor/form-editor-breadcrumb";
import type { FlowNode } from "../form-flow-tree";
import type { NavigationLevel } from "../hooks/use-form-editor-state";
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Skeleton } from '@/ui/skeleton'
import { Badge } from '@/ui/badge'
import { Checkbox } from '@/ui/checkbox'
import { cn } from "@/taali/lib/utils"

interface ServiceEmployeeAssignmentViewProps {
    node: FlowNode;
    onNavigateBack: () => void;
    currentLevel?: NavigationLevel;
    onNavigate?: (level: NavigationLevel) => void;
    onUpdateNode: (nodeId: string, updates: Partial<FlowNode>) => void;
}

interface EmployeeWithState extends MergedEmployee {
    isAssigned: boolean
    order: number
}


// Sortable Employee Item Component
interface SortableEmployeeItemProps {
    employee: EmployeeWithState
    isActive: boolean
    onToggle: (employeeId: string) => void
    isDragOverlay?: boolean
}

const SortableEmployeeItem: React.FC<SortableEmployeeItemProps> = ({ 
    employee, 
    isActive, 
    onToggle,
    isDragOverlay = false
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ 
        id: employee.id,
        disabled: !isActive // Only active employees can be dragged
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative bg-background"
        >
            <div
                className={cn(
                    "flex items-center space-x-3 rounded-lg p-2 hover:bg-primary/5 group w-full",
                    isDragging && !isDragOverlay && "opacity-75 border border-dashed border-primary/50",
                )}
            >
                {/* Drag Handle & Checkbox Container - matches service node styling */}
                <div 
                    className={cn(
                        "h-8 w-8 flex items-center justify-center bg-muted rounded-md border flex-shrink-0",
                        isActive && "cursor-grab active:cursor-grabbing touch-none"
                    )}
                    {...(isActive ? { ...attributes, ...listeners } : {})}
                >
                    <div className={isActive ? "text-muted-foreground" : "text-muted-foreground/40"}>
                        <GripVertical className="h-3.5 w-3.5" />
                    </div>
                </div>
                
                {/* Checkbox */}
                <Checkbox
                    checked={employee.isAssigned}
                    onCheckedChange={() => onToggle(employee.id)}
                />
                
                {/* Employee Info */}
                <div className="flex-1 text-sm font-medium">
                    {employee.name}
                    {employee.email && (
                        <div className="text-xs text-muted-foreground font-normal">
                            {employee.email}
                        </div>
                    )}
                </div>
                
            </div>
        </div>
    );
};

// Divider Component
const EmployeeDivider: React.FC = () => (
    <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-muted" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
                Inactive Employees
            </span>
        </div>
    </div>
);

export function ServiceEmployeeAssignmentView({
    node,
    onNavigateBack,
    currentLevel = 'service-employees',
    onNavigate,
    onUpdateNode
}: ServiceEmployeeAssignmentViewProps) {
    const { activeOrganization } = useActiveOrganization()
    const [activeId, setActiveId] = useState<string | null>(null)
    
    // Fetch organization employees
    const { 
        data: employeeData, 
        isLoading: orgEmployeesLoading,
        error: queryError 
    } = useQuery({
        queryKey: ['organization-employees'],
        queryFn: () => {
            console.log('🔍 [EmployeeAssignment] Fetching employees for org:', activeOrganization?.id)
            return getEmployeesForOrganization()
        },
        enabled: !!activeOrganization?.id,
    })
    
    // Debug logging
    console.log('👥 [EmployeeAssignment] Query state:', {
        isLoading: orgEmployeesLoading,
        hasError: !!queryError,
        employeeData,
        activeOrg: activeOrganization?.id
    })
    
    const orgEmployees = employeeData?.employees || []
    console.log('👥 [EmployeeAssignment] orgEmployees:', orgEmployees)

    // Initialize employee state with assignment status and order
    const [employeesWithState, setEmployeesWithState] = useState<EmployeeWithState[]>([])
    
    // Initialize from node data and org employees
    React.useEffect(() => {
        if (orgEmployees.length > 0) {
            const assignedIds = new Set(node.assignedEmployeeIds || [])
            const employeeOrder = node.assignedEmployeeIds || []
            
            const newEmployeesWithState = orgEmployees
                .filter(emp => emp.isEnabled)
                .map(emp => ({
                    ...emp,
                    isAssigned: assignedIds.has(emp.id),
                    order: employeeOrder.indexOf(emp.id)
                }))
                .sort((a, b) => {
                    // First sort by assigned status
                    if (a.isAssigned !== b.isAssigned) {
                        return a.isAssigned ? -1 : 1
                    }
                    // Then by order for assigned employees
                    if (a.isAssigned && b.isAssigned) {
                        return a.order - b.order
                    }
                    // Keep original order for unassigned
                    return 0
                })
            
            setEmployeesWithState(newEmployeesWithState)
        }
    }, [orgEmployees, node.assignedEmployeeIds])

    // Split employees into active (assigned) and inactive (unassigned)
    const { activeEmployees, inactiveEmployees } = useMemo(() => {
        const active = employeesWithState.filter(e => e.isAssigned)
        const inactive = employeesWithState.filter(e => !e.isAssigned)
        return { activeEmployees: active, inactiveEmployees: inactive }
    }, [employeesWithState])

    // Get the currently dragged employee
    const activeDragEmployee = useMemo(
        () => activeId ? employeesWithState.find(e => e.id === activeId) : null,
        [activeId, employeesWithState]
    )

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    // Handle toggle between active/inactive
    const handleToggleEmployee = React.useCallback((employeeId: string) => {
        setEmployeesWithState(prev => {
            const employee = prev.find(e => e.id === employeeId)
            if (!employee) return prev
            
            const newState = [...prev]
            const employeeIndex = newState.findIndex(e => e.id === employeeId)
            
            if (employee.isAssigned) {
                // Moving from active to inactive - place at beginning of inactive section
                newState[employeeIndex] = { ...employee, isAssigned: false, order: -1 }
            } else {
                // Moving from inactive to active - place at end of active section
                const maxOrder = Math.max(...newState.filter(e => e.isAssigned).map(e => e.order), -1)
                newState[employeeIndex] = { ...employee, isAssigned: true, order: maxOrder + 1 }
            }
            
            // Re-sort the array
            return newState.sort((a, b) => {
                if (a.isAssigned !== b.isAssigned) {
                    return a.isAssigned ? -1 : 1
                }
                if (a.isAssigned && b.isAssigned) {
                    return a.order - b.order
                }
                return 0
            })
        })
    }, [])

    // Handle drag start
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        setActiveId(active.id as string)
    }

    // Handle drag end
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (active.id !== over?.id) {
            setEmployeesWithState((prev) => {
                const oldIndex = prev.findIndex(e => e.id === active.id)
                const newIndex = prev.findIndex(e => e.id === over?.id)
                
                if (oldIndex !== -1 && newIndex !== -1) {
                    const newArray = arrayMove(prev, oldIndex, newIndex)
                    // Update order values for active employees
                    return newArray.map((emp, index) => ({
                        ...emp,
                        order: emp.isAssigned ? index : -1
                    }))
                }
                return prev
            })
        }

        setActiveId(null)
    }

    // Track if component has been initialized to avoid auto-save on mount
    const [isInitialized, setIsInitialized] = React.useState(false)
    
    // Use ref to track if update is needed (prevents infinite loops)
    const lastUpdateRef = React.useRef<string>('')
    
    // Auto-save when employees change (but not on initialization)
    React.useEffect(() => {
        if (isInitialized && employeesWithState.length > 0) {
            const assignedEmployees = employeesWithState
                .filter(e => e.isAssigned)
                .sort((a, b) => a.order - b.order)
                .map(e => e.id)
            
            const currentState = JSON.stringify({
                assignedEmployeeIds: assignedEmployees,
                defaultEmployeeId: assignedEmployees[0] || undefined
            });
            
            // Only update if the state actually changed
            if (currentState !== lastUpdateRef.current) {
                console.log('👥 [EmployeeAssignment] Updating node with new employee assignments:', {
                    nodeId: node.id,
                    assignedEmployees,
                    defaultEmployee: assignedEmployees[0]
                });
                
                onUpdateNode(node.id, {
                    assignedEmployeeIds: assignedEmployees,
                    defaultEmployeeId: assignedEmployees[0] || undefined
                });
                
                lastUpdateRef.current = currentState;
            }
        }
    }, [employeesWithState, node.id, onUpdateNode, isInitialized])
    
    // Mark as initialized after first render
    React.useEffect(() => {
        setIsInitialized(true)
    }, [])

    if (!node) return null

    return (
        <>
            <FormEditorBreadcrumb
                currentLevel={currentLevel}
                selectedNode={node}
                onNavigate={onNavigate || onNavigateBack}
                className="self-start"
            />

            <div className="space-y-6">
                <div>
                    <TitleWithBack
                        title="Employees"
                        currentLevel={currentLevel}
                        selectedNode={node}
                        onNavigateBack={onNavigateBack}
                        className="mb-2"
                    />
                    <p className="text-muted-foreground">
                        Employees will be assigned to incoming jobs based on the order of the list.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Service Assignment
                        </CardTitle>
                        <CardDescription>
                            Select and order employees who can perform the "{node.label}" service.
                            Drag to reorder active employees.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {orgEmployeesLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }, (_, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                                        <Skeleton className="h-5 w-5" />
                                        <Skeleton className="h-5 w-5" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-3 w-48" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : queryError ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-2">Error loading employees</p>
                                <p className="text-sm">
                                    {(queryError as Error)?.message || 'Failed to fetch employees. Please try again.'}
                                </p>
                            </div>
                        ) : orgEmployees.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-2">No employees available</p>
                                <p className="text-sm">
                                    Sync employees from Simpro in your organization settings to assign them to services.
                                </p>
                            </div>
                        ) : employeesWithState.length === 0 && orgEmployees.length > 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-2">No active employees</p>
                                <p className="text-sm">
                                    All synced employees are currently inactive. Enable employees in your organization settings.
                                </p>
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={activeEmployees.map(e => e.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2">
                                            {/* Active Employees */}
                                            {activeEmployees.map((employee) => (
                                                <SortableEmployeeItem
                                                    key={employee.id}
                                                    employee={employee}
                                                    isActive={true}
                                                    onToggle={handleToggleEmployee}
                                                />
                                            ))}
                                            
                                            {/* Divider */}
                                            {inactiveEmployees.length > 0 && activeEmployees.length > 0 && (
                                                <EmployeeDivider key="divider" />
                                            )}
                                            
                                            {/* Inactive Employees */}
                                            {inactiveEmployees.map((employee) => (
                                                <SortableEmployeeItem
                                                    key={employee.id}
                                                    employee={employee}
                                                    isActive={false}
                                                    onToggle={handleToggleEmployee}
                                                />
                                            ))}
                                    </div>
                                </SortableContext>

                                {/* Drag Overlay */}
                                {createPortal(
                                    <DragOverlay adjustScale={false} zIndex={1000}>
                                        {activeId && activeDragEmployee && (
                                            <div className="opacity-40 w-full bg-background rounded-lg shadow-lg">
                                                <SortableEmployeeItem
                                                    employee={activeDragEmployee}
                                                    isActive={true}
                                                    onToggle={() => {}}
                                                    isDragOverlay={true}
                                                />
                                            </div>
                                        )}
                                    </DragOverlay>,
                                    document.body
                                )}
                            </DndContext>
                        )}
                    </CardContent>
                </Card>

                {activeEmployees.length > 0 && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="font-medium">
                            {activeEmployees.length} employee{activeEmployees.length === 1 ? '' : 's'} assigned
                        </p>
                        {activeEmployees[0] && (
                            <p className="text-sm text-muted-foreground">
                                {activeEmployees[0].name} will be assigned by default
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