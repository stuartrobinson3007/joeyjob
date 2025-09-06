"use client"

import { Table } from "@tanstack/react-table"
import { X } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/taali-ui/ui/button"
import { Input } from "@/components/taali-ui/ui/input"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { DataTableDateFilter } from "./data-table-date-filter"
import { DataTableNumberFilter } from "./data-table-number-filter"
import { DataTableConfig, DataTableColumnMeta } from "./types"
import { cn } from "@/components/taali-ui/lib/utils"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  config?: DataTableConfig<TData>
  className?: string
}

export function DataTableToolbar<TData>({
  table,
  config = {},
  className,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0
  const { searchConfig } = config

  const handleSearch = React.useCallback(
    (value: string) => {
      if (searchConfig?.columnId) {
        table.getColumn(searchConfig.columnId)?.setFilterValue(value)
      } else {
        table.setGlobalFilter(value)
      }
    },
    [searchConfig, table]
  )

  const searchValue = React.useMemo(() => {
    if (searchConfig?.columnId) {
      return (table.getColumn(searchConfig.columnId)?.getFilterValue() as string) ?? ""
    }
    return table.getState().globalFilter ?? ""
  }, [searchConfig, table])

  const renderFilter = (columnId: string) => {
    const column = table.getColumn(columnId)
    if (!column) return null

    const meta = column.columnDef.meta as DataTableColumnMeta
    const filterConfig = meta?.filterConfig
    if (!filterConfig) return null

    switch (filterConfig.type) {
      case "select":
      case "multiSelect":
        return (
          <DataTableFacetedFilter
            key={columnId}
            column={column}
            title={filterConfig.title || column.columnDef.header as string}
            options={filterConfig.options || []}
            multiple={filterConfig.type === "multiSelect"}
          />
        )
      case "date":
      case "dateRange":
        return (
          <DataTableDateFilter
            key={columnId}
            column={column}
            title={filterConfig.title || column.columnDef.header as string}
            isRange={filterConfig.type === "dateRange"}
          />
        )
      case "number":
      case "numberRange":
        return (
          <DataTableNumberFilter
            key={columnId}
            column={column}
            title={filterConfig.title || column.columnDef.header as string}
            min={filterConfig.min}
            max={filterConfig.max}
            step={filterConfig.step}
            isRange={filterConfig.type === "numberRange"}
          />
        )
      default:
        return null
    }
  }

  const columnsWithFilters = React.useMemo(() => {
    return table.getAllColumns().filter((column) => {
      const meta = column.columnDef.meta as DataTableColumnMeta
      return !!meta?.filterConfig
    })
  }, [table])

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder={searchConfig?.placeholder || "Search..."}
          value={searchValue}
          onChange={(event) => handleSearch(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {columnsWithFilters.map((column) => renderFilter(column.id))}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}