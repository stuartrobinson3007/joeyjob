/**
 * Data Table Advanced Toolbar
 * 
 * Wrapper for advanced filtering modes (both Command and Advanced).
 * Provides consistent layout for enhanced filtering experiences.
 */

import type { Table } from "@tanstack/react-table";
import type * as React from "react";
import { cn } from "../../lib/utils";
import { DataTableViewOptions } from "./view-options";

interface DataTableAdvancedToolbarProps<TData>
  extends React.ComponentProps<"div"> {
  table: Table<TData>;
  search?: React.ReactNode;
}

export function DataTableAdvancedToolbar<TData>({
  table,
  children,
  search,
  className,
  ...props
}: DataTableAdvancedToolbarProps<TData>) {
  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn(
        "flex w-full items-start justify-between gap-2 p-1",
        className,
      )}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
      <div className="flex items-center gap-2">
        {search}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}