/**
 * Data Table Search Component
 * 
 * Search input that writes to URL state for shadcn table integration
 */

import { Search } from "lucide-react";
import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { Input } from "../input";
import { cn } from "../../lib/utils";

interface DataTableSearchProps extends React.ComponentProps<"div"> {
  table: Table<unknown>;
  placeholder?: string;
}

export function DataTableSearch({
  table,
  placeholder = "Search...",
  className,
  ...props
}: DataTableSearchProps) {
  // TanStack doesn't have built-in search state, so we'll use a simple approach
  // For now, we'll use a separate state that triggers global filtering
  const [search, setSearch] = React.useState('');
  
  // Update table's global filter when search changes
  React.useEffect(() => {
    table.setGlobalFilter(search);
  }, [search, table]);

  return (
    <div className={cn("relative max-w-sm", className)} {...props}>
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}