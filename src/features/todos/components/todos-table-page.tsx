"use client"

import * as React from 'react'
import { useMemo } from 'react'
import { ColumnDef } from "@tanstack/react-table"
import { format } from 'date-fns'
import { MoreHorizontal, Check, Clock, ArrowUpDown, Trash2 } from 'lucide-react'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useSetPageMeta } from '@/lib/hooks/page-context'
import { DataTable } from '@/components/data-table/data-table'
import { useTableQuery } from '@/lib/hooks/use-table-query'
import { getTodosTable, getTodosTableCount, getAllTodosIds, bulkDeleteTodos } from '../lib/todos-table.server'
import { toggleTodo, deleteTodo } from '../lib/todos.server'
import { DataTableConfig, DataTableColumnMeta, SelectionState, BulkAction } from '@/components/data-table/types'
import { Button } from '@/components/taali-ui/ui/button'
import { Badge } from '@/components/taali-ui/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/taali-ui/ui/dropdown-menu'
import { toast } from 'sonner'
import { Checkbox } from '@/components/taali-ui/ui/checkbox'

interface Todo {
  id: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high'
  completed: boolean
  dueDate: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: string
  assignedTo: string | null
  organizationId: string
}

export function TodosTablePage() {
  const { activeOrganizationId } = useActiveOrganization()
  const [currentFilters, setCurrentFilters] = React.useState({})
  const [currentSelection, setCurrentSelection] = React.useState<SelectionState>({
    selectedIds: new Set(),
    isAllSelected: false,
    totalSelectedCount: 0,
  })
  const [clearSelectionFn, setClearSelectionFn] = React.useState<(() => void) | null>(null)
  
  // Set page metadata
  useSetPageMeta({
    title: 'Todos (Data Table)',
    actions: (
      <Button size="sm">
        Add Todo
      </Button>
    )
  }, [])

  // Use the table query hook
  const {
    data,
    totalCount,
    isLoading,
    onStateChange,
    refetch,
  } = useTableQuery<Todo>({
    queryKey: ['todos-table', activeOrganizationId || ''],
    queryFn: (params) => {
      setCurrentFilters(params)
      return getTodosTable({ data: params })
    },
    enabled: !!activeOrganizationId,
  })

  const handleToggle = React.useCallback(async (id: string) => {
    try {
      await toggleTodo({ data: { id } })
      refetch()
      toast.success('Todo updated')
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to update todo')
    }
  }, [refetch])

  const handleDelete = React.useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this todo?')) return
    
    try {
      await deleteTodo({ data: { id } })
      refetch()
      toast.success('Todo deleted')
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to delete todo')
    }
  }, [refetch])

  const handleBulkDelete = React.useCallback(async (selectedIds: string[], isAllSelected: boolean) => {
    const count = selectedIds.length

    if (!confirm(`Are you sure you want to delete ${count} todo${count !== 1 ? 's' : ''}?`)) return
    
    try {
      await bulkDeleteTodos({ 
        data: { 
          ids: selectedIds 
        } 
      })
      
      // Clear selection after successful delete
      if (clearSelectionFn) {
        clearSelectionFn()
      }
      
      refetch()
      toast.success(`${count} todo${count !== 1 ? 's' : ''} deleted`)
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to delete todos')
    }
  }, [refetch, clearSelectionFn])

  const handleSelectAll = React.useCallback(async (filters: any) => {
    const result = await getAllTodosIds({ data: filters })
    return result.ids
  }, [])

  const handleSelectionChange = React.useCallback((selection: SelectionState, clearSelection: () => void) => {
    setCurrentSelection(selection)
    setClearSelectionFn(() => clearSelection)
  }, [])

  const columns: ColumnDef<Todo>[] = useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "completed",
      header: "Status",
      enableColumnFilter: true,
      cell: ({ row }) => {
        const completed = row.getValue("completed") as boolean
        return (
          <button
            onClick={() => handleToggle(row.original.id)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              completed
                ? 'bg-primary border-primary'
                : 'border-input hover:border-ring'
            }`}
          >
            {completed && <Check className="w-3 h-3 text-white" />}
          </button>
        )
      },
      meta: {
        filterConfig: {
          type: "select",
          title: "Status",
          options: [
            { label: "Completed", value: "true" },
            { label: "Incomplete", value: "false" },
          ],
        },
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "title",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Title
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      enableSorting: true,
      cell: ({ row }) => {
        return (
          <div>
            <div className="font-medium">{row.getValue("title")}</div>
            {row.original.description && (
              <div className="text-sm text-muted-foreground">
                {row.original.description}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "priority",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Priority
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      enableColumnFilter: true,
      enableSorting: true,
      cell: ({ row }) => {
        const priority = row.getValue("priority") as string
        const variant = 
          priority === "high" ? "destructive" :
          priority === "medium" ? "default" :
          "secondary"
        
        return (
          <Badge variant={variant as any}>
            {priority}
          </Badge>
        )
      },
      meta: {
        filterConfig: {
          type: "multiSelect",
          title: "Priority",
          options: [
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
          ],
        },
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Due Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      enableColumnFilter: true,
      enableSorting: true,
      cell: ({ row }) => {
        const dueDate = row.getValue("dueDate") as Date | null
        if (!dueDate) return <span className="text-muted-foreground">-</span>
        
        return (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(dueDate), "MMM d, yyyy")}
          </div>
        )
      },
      meta: {
        filterConfig: {
          type: "dateRange",
          title: "Due Date",
        },
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      enableColumnFilter: true,
      enableSorting: true,
      cell: ({ row }) => {
        return format(new Date(row.getValue("createdAt")), "MMM d, yyyy")
      },
      meta: {
        filterConfig: {
          type: "dateRange",
          title: "Created Date",
        },
      } as DataTableColumnMeta,
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleToggle(row.original.id)}>
                {row.original.completed ? "Mark incomplete" : "Mark complete"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDelete(row.original.id)}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [handleToggle, handleDelete])

  const bulkActions: BulkAction[] = useMemo(() => [
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      onClick: handleBulkDelete,
    },
  ], [handleBulkDelete])

  const config: DataTableConfig<Todo> = {
    searchConfig: {
      placeholder: "Search todos...",
      columnId: "title",
    },
    paginationConfig: {
      pageSizeOptions: [10, 20, 30, 50],
      defaultPageSize: 10,
    },
    selectionConfig: {
      enableBulkActions: true,
      bulkActions,
    },
    enableColumnFilters: true,
    enableSorting: true,
    enableRowSelection: true,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
  }

  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">No Organization Selected</h2>
        <p className="text-muted-foreground">
          Please select an organization from the switcher above to view todos.
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <DataTable
        columns={columns}
        data={data}
        config={config}
        totalCount={totalCount}
        onStateChange={onStateChange}
        onSelectionChange={handleSelectionChange}
        onSelectAll={handleSelectAll}
        currentFilters={currentFilters}
        isLoading={isLoading}
      />
    </div>
  )
}