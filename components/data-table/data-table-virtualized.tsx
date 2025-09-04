/**
 * Virtualized Data Table Component
 * 
 * Wrapper for the main DataTable that adds virtualization
 * for handling large datasets efficiently.
 */

// import { useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";
import { cn } from "../../lib/utils";

interface VirtualizedDataTableProps<TData> {
  table: TanstackTable<TData>;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  estimateSize?: number;
  overscan?: number;
  className?: string;
}

export function VirtualizedDataTable<TData>({
  table,
  loading = false,
  error = null,
  emptyMessage = "No data available",
  estimateSize = 60,
  overscan = 10,
  className,
}: VirtualizedDataTableProps<TData>) {
  const { rows } = table.getRowModel();

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => document.getElementById('table-container'),
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0;

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

  // Show empty state
  if (!loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      id="table-container"
      className={cn("overflow-auto h-[600px] rounded-md border", className)}
    >
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDirection = header.column.getIsSorted();

                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      canSort && "cursor-pointer select-none hover:bg-muted/50",
                      "relative"
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="flex items-center space-x-2">
                      <span>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </span>
                      {canSort && (
                        <span className="text-xs text-muted-foreground">
                          {sortDirection === "asc" && "↑"}
                          {sortDirection === "desc" && "↓"}
                          {sortDirection === false && "↕"}
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} />
            </tr>
          )}
          {loading && rows.length === 0 ? (
            // Loading skeleton
            Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index}>
                {table.getVisibleFlatColumns().map((column) => (
                  <TableCell key={column.id}>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            // Virtual rows
            virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <TableRow
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={(node) => virtualizer.measureElement(node)}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "hover:bg-muted/50",
                    loading && "opacity-60 pointer-events-none loading-pulse",
                    row.getIsSelected() && "bg-muted/30"
                  )}
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
              );
            })
          )}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </TableBody>
      </Table>
      
    </div>
  );
}