/**
 * Data Table Resizer Component
 * 
 * Column resizing handle for tables with visual feedback.
 * Adapted from tnks-data-table for professional column management.
 */

// import React from "react";
import { Separator } from "../separator";
import { cn } from "../../lib/utils";
import { GripVertical } from "lucide-react";

interface DataTableResizerProps {
  header: any; // TanStack header object
  table: any;  // TanStack table object
}

export function DataTableResizer({ header, table: _table }: DataTableResizerProps) {
  const isResizing = header.column.getIsResizing();

  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className={cn(
        "absolute right-0 top-0 flex h-full w-4 cursor-col-resize select-none touch-none items-center justify-center",
        "opacity-0 group-hover/th:opacity-100 z-10",
        isResizing && "opacity-100"
      )}
      aria-hidden="true"
      data-resizing={isResizing ? "true" : undefined}
    >
      <div className="flex h-4/5 items-center justify-center">
        <Separator
          orientation="vertical"
          decorative={false}
          className={cn(
            "h-4/5 w-0.5 transition-colors duration-200",
            isResizing ? 
              "bg-primary" : 
              "bg-border"
          )}
        />
        
        {/* Visual grip indicator */}
        <GripVertical 
          className={cn(
            "absolute h-4 w-4 text-muted-foreground/70",
            isResizing ? "text-primary" : "text-muted-foreground/70"
          )}
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
}