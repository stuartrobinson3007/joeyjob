"use client"

import * as React from 'react'
import { useMemo } from 'react'
import { ColumnDef } from "@tanstack/react-table"
import { format } from 'date-fns'
import { MoreHorizontal, Clock, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Edit2, Plus, Loader2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { PageHeader } from '@/components/page-header'
import { useLoadingItems } from '@/lib/hooks/use-loading-state'
import { DataTable, DataTableHeader } from '@/components/taali-ui/data-table'
import { useTableQuery } from '@/components/taali-ui/data-table'
import { getTodosTable, getAllTodosIds, bulkDeleteTodos, getTodoCreators } from '../lib/todos-table.server'
import { toggleTodo, deleteTodo, createTodo } from '../lib/todos.server'
import { todoKeys } from '../lib/query-keys'
import { DataTableConfig, DataTableColumnMeta, SelectionState, BulkAction } from '@/components/taali-ui/data-table'
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
import { usePermissions } from '@/lib/hooks/use-permissions'

interface Todo {
  id: string
  title: string
  description: string | null
  priority: number
  completed: boolean
  dueDate: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: string
  createdByName: string | null
  assignedTo: string | null
  organizationId: string
}

export function TodosTablePage() {
  const { activeOrganizationId } = useActiveOrganization()
  const navigate = useNavigate()
  const { canCreateTodo, canUpdateTodo, canDeleteTodo, isLoading: permissionsLoading } = usePermissions()
  const [isCreating, setIsCreating] = React.useState(false)
  const [currentFilters, setCurrentFilters] = React.useState({})
  const [currentSelection, setCurrentSelection] = React.useState<SelectionState>({
    selectedIds: new Set(),
    isAllSelected: false,
    totalSelectedCount: 0,
  })
  const [clearSelectionFn, setClearSelectionFn] = React.useState<(() => void) | null>(null)

  // Loading states for individual todo actions
  const { isLoading: isLoadingTodo, startLoading: startTodoLoading, stopLoading: stopTodoLoading, loadingItems: loadingTodos } = useLoadingItems<string>()
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)

  // Use the table query hook with hierarchical query keys
  const {
    data,
    totalCount,
    isLoading,
    isFetching,
    onStateChange,
    refetch,
  } = useTableQuery<Todo>({
    queryKey: activeOrganizationId ? todoKeys.tables(activeOrganizationId) : [],
    queryFn: (params) => {
      setCurrentFilters(params)
      return getTodosTable({ data: params })
    },
    enabled: !!activeOrganizationId,
  })


  const handleCreateTodo = React.useCallback(async () => {
    if (!activeOrganizationId) {
      toast.error('Please select an organization')
      return
    }

    setIsCreating(true)
    try {
      const created = await createTodo({
        data: {
          title: 'Untitled Todo',
          description: '',
          priority: 'medium',
        }
      })

      toast.success('Todo created! Opening editor...')
      navigate({ to: `/todos/${created.id}/edit` })
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to create todo')
      setIsCreating(false)
    }
  }, [activeOrganizationId, navigate])


  const handleToggle = React.useCallback(async (id: string) => {
    startTodoLoading(id)
    try {
      await toggleTodo({ data: { id } })
      refetch()
      toast.success('Todo updated')
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to update todo')
    } finally {
      stopTodoLoading(id)
    }
  }, [refetch, startTodoLoading, stopTodoLoading])

  const handleDelete = React.useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this todo?')) return

    startTodoLoading(id)
    try {
      await deleteTodo({ data: { id } })
      refetch()
      toast.success('Todo deleted')
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to delete todo')
    } finally {
      stopTodoLoading(id)
    }
  }, [refetch, startTodoLoading, stopTodoLoading])

  const handleBulkDelete = React.useCallback(async (selectedIds: string[], isAllSelected: boolean) => {
    const count = selectedIds.length

    if (!confirm(`Are you sure you want to delete ${count} todo${count !== 1 ? 's' : ''}?`)) return

    setIsBulkDeleting(true)
    // Add all selected items to loading state
    selectedIds.forEach(id => startTodoLoading(id))

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
    } finally {
      // Clear all loading states
      selectedIds.forEach(id => stopTodoLoading(id))
      setIsBulkDeleting(false)
    }
  }, [refetch, clearSelectionFn, startTodoLoading, stopTodoLoading])

  const handleSelectAll = React.useCallback(async (filters: any) => {
    const result = await getAllTodosIds({ data: filters })
    return result.ids
  }, [])

  const handleSelectionChange = React.useCallback((selection: SelectionState, clearSelection: () => void) => {
    setCurrentSelection(selection)
    setClearSelectionFn(() => clearSelection)
  }, [])

  const handleRowClick = React.useCallback((todo: Todo) => {
    navigate({ to: `/todos/${todo.id}/edit` })
  }, [navigate])


  const columns: ColumnDef<Todo>[] = useMemo(() => {
    const cols: ColumnDef<Todo>[] = []

    // Only add select column if user can delete
    if (canDeleteTodo()) {
      cols.push({
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
        enableResizing: false,
        size: 40,
      })
    }

    // Add all other columns
    cols.push(
      {
        accessorKey: "completed",
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            Status
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 100,
        cell: ({ row }) => {
          const completed = row.getValue("completed") as boolean
          return (
            <Badge 
              variant={completed ? "success" : "warning"} 
              style="soft"
              status={completed}
            >
              {completed ? "Done" : "Pending"}
            </Badge>
          )
        },
        meta: {
          filterConfig: {
            type: "select",
            title: "Status",
            options: [
              { label: "Done", value: "true" },
              { label: "Pending", value: "false" },
            ],
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            Title
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 250,
        cell: ({ row }) => {
          return (
            <div>
              <div className="font-medium truncate">{row.getValue("title")}</div>
              {row.original.description && (
                <div className="text-sm text-muted-foreground truncate">
                  {row.original.description}
                </div>
              )}
            </div>
          )
        },
        meta: {
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: "priority",
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            Priority
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 80,
        cell: ({ row }) => {
          const priority = row.getValue("priority") as number
          return <span className="font-mono">{priority}</span>
        },
        meta: {
          filterConfig: {
            type: "numberRange",
            title: "Priority",
            min: 1,
            max: 5,
            step: 1,
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            Due Date
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          const dueDate = row.getValue("dueDate") as Date | null
          if (!dueDate) return <span className="text-muted-foreground">-</span>

          return (
            <div className="flex items-center gap-1">
              <Clock className="min-w-3 h-3" />
              {format(new Date(dueDate), "MMM d, yyyy")}
            </div>
          )
        },
        meta: {
          filterConfig: {
            type: "dateRange",
            title: "Due Date",
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            Created
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          return format(new Date(row.getValue("createdAt")), "MMM d, yyyy")
        },
        meta: {
          filterConfig: {
            type: "dateRange",
            title: "Created Date",
          },
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: "createdByName",
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            Created By
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 130,
        cell: ({ row }) => {
          const createdByName = row.getValue("createdByName") as string | null
          return createdByName ? (
            <span className="text-sm">{createdByName}</span>
          ) : (
            <span className="text-muted-foreground text-sm">Unknown</span>
          )
        },
        meta: {
          filterConfig: {
            type: "dynamicMultiSelect",
            title: "Created By",
            loadOptions: async () => {
              const result = await getTodoCreators()
              return result
            },
          },
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        id: "markDone",
        enableHiding: false,
        enableResizing: false,
        size: 120,
        cell: ({ row }) => {
          const completed = row.original.completed
          const isLoading = isLoadingTodo(row.original.id)
          const canUpdate = canUpdateTodo()

          if (completed || isLoading || !canUpdate) return null

          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleToggle(row.original.id)}
              className="h-7"
            >
              Mark as Done
            </Button>
          )
        },
      },
      {
        id: "actions",
        enableHiding: false,
        enableResizing: false,
        size: 50,
        cell: ({ row }) => {
          const isLoading = isLoadingTodo(row.original.id)
          const canUpdate = canUpdateTodo()
          const canDelete = canDeleteTodo()

          // Don't show menu if user has no permissions
          if (!canUpdate && !canDelete) return null

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
                  <span className="sr-only">Open menu</span>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {canUpdate && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleToggle(row.original.id)}
                      disabled={isLoading}
                    >
                      {row.original.completed ? "Mark incomplete" : "Mark complete"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate({ to: `/todos/${row.original.id}/edit` })}
                      disabled={isLoading}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    {canUpdate && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => handleDelete(row.original.id)}
                      className="text-destructive"
                      disabled={isLoading}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      }
    )

    return cols
  }, [handleToggle, handleDelete, navigate, isLoadingTodo, canUpdateTodo, canDeleteTodo])

  const bulkActions: BulkAction[] = useMemo(() => {
    const actions: BulkAction[] = []

    if (canDeleteTodo()) {
      actions.push({
        id: 'delete',
        label: isBulkDeleting ? 'Deleting...' : 'Delete',
        icon: Trash2,
        variant: 'destructive',
        onClick: handleBulkDelete,
        disabled: isBulkDeleting,
      })
    }

    return actions
  }, [handleBulkDelete, isBulkDeleting, canDeleteTodo])

  const config = React.useMemo<DataTableConfig<Todo>>(() => ({
    searchConfig: {
      placeholder: "Search todos..."
    },
    paginationConfig: {
      pageSizeOptions: [10, 20, 30, 50],
      defaultPageSize: 10,
    },
    selectionConfig: {
      enableBulkActions: canDeleteTodo(),
      bulkActions,
    },
    enableColumnFilters: true,
    enableSorting: true,
    enableRowSelection: canDeleteTodo(),
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
  }), [bulkActions, canDeleteTodo])

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
    <div className="flex flex-col h-full">
      <PageHeader
        title="Todos"
        actions={canCreateTodo() ? (
          <Button
            size="sm"
            onClick={handleCreateTodo}
            disabled={isCreating}
          >
            <Plus className="w-4 h-4 mr-2" />
            {isCreating ? 'Creating...' : 'Add Todo'}
          </Button>
        ) : undefined}
      />

      {/* Main Content */}
      <div className="flex-1 p-4">
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
        isFetching={isFetching}
        loadingRows={loadingTodos}
        getRowIdProp={(row) => row.id}
        onRowClick={handleRowClick}
        className='max-h-[600px]'
      />
      </div>
    </div>
  )
}