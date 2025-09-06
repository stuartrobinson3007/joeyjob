"use client"

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/taali-ui/ui/table"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"
import { DataTableBulkActions } from "./data-table-bulk-actions"
import { DataTableConfig, SelectionState, ServerQueryParams } from "./types"
import { cn } from "@/components/taali-ui/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  config?: DataTableConfig<TData>
  totalCount?: number
  onStateChange?: (state: any) => void
  onSelectionChange?: (selection: SelectionState, clearSelection: () => void) => void
  onSelectAll?: (filters: ServerQueryParams) => Promise<string[]>
  currentFilters?: ServerQueryParams
  isLoading?: boolean
  className?: string
  toolbarClassName?: string
  containerClassName?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  config = {},
  totalCount,
  onStateChange,
  onSelectionChange,
  onSelectAll,
  currentFilters,
  isLoading = false,
  className,
  toolbarClassName,
  containerClassName,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  
  // Simplified ID-based selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [isAllSelected, setIsAllSelected] = React.useState(false)

  const {
    manualFiltering = false,
    manualPagination = false,
    manualSorting = false,
    enableColumnFilters = true,
    enableSorting = true,
    enableRowSelection = false,
    paginationConfig = {},
    selectionConfig = {},
  } = config

  // Get ID from row data - assumes 'id' property exists
  const getRowId = React.useCallback((row: any) => {
    return row?.id || String(row.index)
  }, [])

  // Convert selectedIds to TanStack Table's index-based selection for current page
  const currentPageRowSelection = React.useMemo(() => {
    if (isAllSelected) {
      // If all are selected, show all current page rows as selected
      return Object.fromEntries(data.map((_, index) => [index.toString(), true]))
    }
    
    // Show only rows with IDs in selectedIds as selected
    const selection: Record<string, boolean> = {}
    data.forEach((row, index) => {
      const id = getRowId(row)
      if (selectedIds.has(id)) {
        selection[index.toString()] = true
      }
    })
    return selection
  }, [data, selectedIds, isAllSelected, getRowId])

  // Handle row selection changes from TanStack Table
  const handleRowSelectionChange = React.useCallback((updater: any) => {
    const newIndexSelection = typeof updater === 'function' ? updater(currentPageRowSelection) : updater
    
    // Check if this is a "select/deselect all" operation (all current page items)
    const currentPageSize = data.length
    const newSelectionSize = Object.keys(newIndexSelection).filter(key => newIndexSelection[key]).length
    const isSelectingAllCurrentPage = newSelectionSize === currentPageSize
    const isDeselectingAll = newSelectionSize === 0
    
    if (isDeselectingAll) {
      // Deselect all - clear everything regardless of current mode
      setSelectedIds(new Set())
      setIsAllSelected(false)
      setRowSelection({})
      return
    }
    
    if (isSelectingAllCurrentPage && Object.keys(currentPageRowSelection).length === 0) {
      // Selecting all on current page - just add current page items
      const newSelectedIds = new Set(selectedIds)
      data.forEach((row, index) => {
        const id = getRowId(row)
        if (newIndexSelection[index.toString()]) {
          newSelectedIds.add(id)
        }
      })
      setSelectedIds(newSelectedIds)
      setIsAllSelected(false) // Keep in normal mode, not "all selected"
      setRowSelection(newIndexSelection)
      return
    }
    
    // Individual item selection/deselection
    const newSelectedIds = new Set(selectedIds)
    
    // If we were in "all selected" mode, exit it when individual items are toggled
    if (isAllSelected) {
      setIsAllSelected(false)
    }
    
    // Update selectedIds based on current page changes
    data.forEach((row, index) => {
      const id = getRowId(row)
      const indexStr = index.toString()
      
      if (newIndexSelection[indexStr]) {
        newSelectedIds.add(id)
      } else if (currentPageRowSelection[indexStr]) {
        // This row was previously selected but now isn't
        newSelectedIds.delete(id)
      }
    })
    
    setSelectedIds(newSelectedIds)
    setRowSelection(newIndexSelection)
  }, [currentPageRowSelection, isAllSelected, selectedIds, data, getRowId])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection: currentPageRowSelection,
      columnFilters,
      globalFilter,
    },
    enableRowSelection,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualFiltering,
    manualPagination,
    manualSorting,
    ...(manualPagination && totalCount
      ? {
          pageCount: Math.ceil(totalCount / (paginationConfig.defaultPageSize || 10)),
        }
      : {}),
  })

  React.useEffect(() => {
    if (onStateChange) {
      onStateChange({
        search: globalFilter,
        columnFilters,
        sorting,
        pagination: {
          pageIndex: table.getState().pagination.pageIndex,
          pageSize: table.getState().pagination.pageSize,
        },
      })
    }
  }, [
    globalFilter,
    columnFilters,
    sorting,
    table.getState().pagination.pageIndex,
    table.getState().pagination.pageSize,
    onStateChange,
  ])

  React.useEffect(() => {
    if (paginationConfig.defaultPageSize) {
      table.setPageSize(paginationConfig.defaultPageSize)
    }
  }, [paginationConfig.defaultPageSize, table])

  // Current selection state for parent component
  const selectionState: SelectionState = React.useMemo(() => ({
    selectedIds,
    isAllSelected,
    totalSelectedCount: isAllSelected ? (totalCount || 0) : selectedIds.size
  }), [selectedIds, isAllSelected, totalCount])

  // Clear selection function to pass to parent
  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
    setIsAllSelected(false)
    setRowSelection({})
  }, [])

  // Notify parent of selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectionState, clearSelection)
    }
  }, [selectionState, onSelectionChange, clearSelection])

  // Clear selection when filters change
  React.useEffect(() => {
    setSelectedIds(new Set())
    setIsAllSelected(false)
    setRowSelection({})
  }, [columnFilters, globalFilter])

  return (
    <div className={cn("space-y-4", containerClassName)}>
      {enableColumnFilters && (
        <DataTableToolbar
          table={table}
          config={config}
          className={toolbarClassName}
        />
      )}
      <div className={cn("rounded-md border", className)}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as any
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.getCanSort() && "cursor-pointer select-none",
                        meta?.headerClassName
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as any
                    return (
                      <TableCell key={cell.id} className={meta?.cellClassName}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} config={paginationConfig} totalCount={totalCount} />
      
      {/* Bulk Actions Bar */}
      {enableRowSelection && selectionConfig.enableBulkActions && (selectionState.totalSelectedCount > 0) && (
        <DataTableBulkActions
          selection={selectionState}
          totalCount={totalCount || 0}
          onSelectAll={async () => {
            if (onSelectAll && currentFilters) {
              const allIds = await onSelectAll(currentFilters)
              setSelectedIds(new Set(allIds))
              setIsAllSelected(true)
            }
          }}
          onClearSelection={() => {
            setSelectedIds(new Set())
            setIsAllSelected(false)
            setRowSelection({})
          }}
          bulkActions={selectionConfig.bulkActions}
        />
      )}
    </div>
  )
}