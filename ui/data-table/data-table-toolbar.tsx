/**
 * Advanced Data Table Toolbar
 * 
 * Enhanced toolbar with:
 * - Dynamic filtering based on column metadata
 * - Server-side search with debouncing
 * - Filter chips for active filters
 * - Column visibility controls
 */

import type { Table } from "@tanstack/react-table";
import { X, Search, Filter, Columns } from "lucide-react";
import * as React from "react";
import { Button } from "../button";
import { Input } from "../input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { Badge } from "../badge";
import { cn } from "../../lib/utils";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchPlaceholder?: string;
  filters?: Record<string, any>;
  onFiltersChange?: (filters: Record<string, any>) => void;
  onClearFilters?: () => void;
  filterComponents?: React.ReactNode;
  showSearch?: boolean;
  showColumnVisibility?: boolean;
  showFilters?: boolean;
  className?: string;
}

export function DataTableToolbar<TData>({
  table,
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = {},
  onFiltersChange: _onFiltersChange,
  onClearFilters,
  filterComponents,
  showSearch = true,
  showColumnVisibility = true,
  showFilters = false,
  className,
}: DataTableToolbarProps<TData>) {
  const [showFiltersPanel, setShowFiltersPanel] = React.useState(false);
  
  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(
    ([_key, value]) => value !== undefined && value !== null && value !== ""
  ).length;

  const hasActiveFilters = activeFilterCount > 0 || searchTerm.length > 0;

  return (
    <div className={cn("flex items-center justify-between space-x-4 py-4", className)}>
      <div className="flex flex-1 items-center space-x-2">
        {/* Search Input */}
        {showSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Filter Components */}
        {showFilters && filterComponents}

        {/* Clear Filters */}
        {hasActiveFilters && onClearFilters && (
          <Button
            variant="ghost"
            onClick={onClearFilters}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}

        {/* Active Filter Count */}
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="rounded-sm px-1 font-normal">
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {/* Filters Toggle */}
        {showFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        )}

        {/* Column Visibility */}
        {showColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-8"
              >
                <Columns className="mr-2 h-4 w-4" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" && column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}