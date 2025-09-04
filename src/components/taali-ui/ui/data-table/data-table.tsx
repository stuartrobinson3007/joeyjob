/**
 * Advanced Data Table Component
 * 
 * Based on shadcn-table with enhancements for:
 * - Row selection and bulk actions
 * - Advanced filtering and search
 * - Server-side operations with tRPC
 * - Virtualization for large datasets
 */

import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";
import { cn } from "../../lib/utils";
import { DataTablePagination } from "./data-table-pagination";

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  loadingMessage?: string;
  pagination?: any; // Pagination metadata from server
  onRowClick?: (row: any) => void;
}

export function DataTable<TData>({
  table,
  actionBar,
  loading = false,
  error = null,
  emptyMessage = "No data available",
  loadingMessage = "Loading...",
  pagination,
  onRowClick,
  children,
  className,
  ...props
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <div className="text-center">
          <p className="text-sm font-medium">Error loading data</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex w-full flex-col gap-2.5", className)}
      {...props}
    >
      {children}
      {actionBar}
      <div className="rounded-md border">
        <Table aria-busy={loading}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ width: header.getSize() }}
                    className="relative"
                  >
                    {header.isPlaceholder ? null : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                    
                    {/* Column Resizer */}
                    {header.column.getCanResize() && (
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-transparent hover:bg-primary/50 active:bg-primary"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              // Show loading skeleton for initial load
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {table.getVisibleFlatColumns().map((column) => (
                    <TableCell key={column.id}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleFlatColumns().length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              // Data rows
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "hover:bg-muted/50",
                    onRowClick && "cursor-pointer",
                    loading && "opacity-60 pointer-events-none loading-pulse",
                    row.getIsSelected() && "bg-muted/30"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} pagination={pagination} loading={loading} />
    </div>
  );
}