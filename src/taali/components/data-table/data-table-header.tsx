import * as React from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Column } from '@tanstack/react-table'

import { Button } from '../ui/button'

interface DataTableHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  children: React.ReactNode
  sortable?: boolean
}

export function DataTableHeader<TData, TValue>({ column, children, sortable = false }: DataTableHeaderProps<TData, TValue>) {
  if (!sortable || !column.getCanSort()) {
    return <span className="font-medium">{children}</span>
  }

  const sortDirection = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sortDirection === 'asc')}
      className="h-auto px-2 py-1 -ml-2 hover:bg-accent hover:text-accent-foreground"
    >
      {children}
      <div className="ml-2 h-4 w-4">
        {sortDirection === 'asc' ? (
          <ArrowUp />
        ) : sortDirection === 'desc' ? (
          <ArrowDown />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </Button>
  )
}
