import * as React from "react"
import { Button } from "../ui/button"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

interface DataTableHeaderProps {
  column: any
  children: React.ReactNode
  sortable?: boolean
}

export function DataTableHeader({ 
  column, 
  children, 
  sortable = false 
}: DataTableHeaderProps) {
  if (!sortable || !column.getCanSort()) {
    return <span className="font-medium">{children}</span>
  }

  const sortDirection = column.getIsSorted()
  
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sortDirection === "asc")}
      className="h-auto px-2 py-1 -ml-2 hover:bg-accent hover:text-accent-foreground"
    >
      {children}
      <div className="ml-2 h-4 w-4">
        {sortDirection === "asc" ? (
          <ArrowUp className="h-4 w-4" />
        ) : sortDirection === "desc" ? (
          <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </Button>
  )
}