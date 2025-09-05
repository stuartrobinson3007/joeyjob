/**
 * Enhanced Column Header Component
 * 
 * Full-width clickable column header with cycle sorting.
 * Click to cycle: unsorted → asc → desc → unsorted
 */

import {
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronsUpDownIcon,
} from "lucide-react";
import type { Column } from "@tanstack/react-table";
import { cn } from "../../lib/utils";
import { Button } from "../button";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <div className={cn("w-full h-full flex items-center", className)}>
        {title}
      </div>
    );
  }

  // Get the current sort direction for this column
  const currentDirection = column.getIsSorted();

  // Handle cycling through sort states: unsorted → asc → desc → unsorted
  const handleSort = () => {
    if (currentDirection === false) {
      // Currently unsorted → sort ascending
      column.toggleSorting(false, false);
    } else if (currentDirection === "asc") {
      // Currently ascending → sort descending  
      column.toggleSorting(true, false);
    } else {
      // Currently descending → clear sort
      column.clearSorting();
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSort}
      className={cn(
        "w-full h-full justify-start p-2 font-medium text-left",
        "hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0",
        className
      )}
    >
      <span className="truncate">{title}</span>
      <div className="ml-auto flex-shrink-0">
        {currentDirection === "desc" ? (
          <ArrowDownIcon className="h-4 w-4" />
        ) : currentDirection === "asc" ? (
          <ArrowUpIcon className="h-4 w-4" />
        ) : (
          <ChevronsUpDownIcon className="h-4 w-4 opacity-50" />
        )}
      </div>
    </Button>
  );
}