"use client";

import type { Column, Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import * as React from "react";

import { DataTableDateFilter } from "./data-table-date-filter";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { DataTableSliderFilter } from "./data-table-slider-filter";
import { DataTableViewOptions } from "./view-options";
import { Button } from "../button";
import { Input } from "../input";
import { cn } from "../../lib/utils";
import { generateId } from "../../lib/id";
import type { ExtendedColumnFilter } from "../../types/data-table";

interface DataTableToolbarProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  // Use TanStack columnFilters state for consistency with other filter modes
  const columnFilters = table.getState().columnFilters;
  
  // Extract ExtendedColumnFilter objects from TanStack value field
  const filters = columnFilters.map(filter => {
    const filterValue = filter.value as any;
    return {
      id: filter.id,
      value: filterValue.value || filterValue.actualValue || filterValue,
      operator: filterValue.operator || 'eq',
      variant: filterValue.variant || 'text',
      filterId: filterValue.filterId || `${filter.id}-${Date.now()}`
    } as ExtendedColumnFilter<TData>;
  });
  

  const isFiltered = filters.length > 0;
  

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table],
  );

  const onReset = React.useCallback(() => {
    table.setColumnFilters([]);
  }, [table]);

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
        {columns.map((column) => (
          <DataTableToolbarFilter key={column.id} column={column} table={table} />
        ))}
        {isFiltered && (
          <Button
            aria-label="Reset filters"
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={onReset}
          >
            <X />
            Reset
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
interface DataTableToolbarFilterProps<TData> {
  column: Column<TData>;
}

function DataTableToolbarFilter<TData>({
  column,
  table,
}: DataTableToolbarFilterProps<TData> & { table: Table<TData> }) {
  // Use TanStack columnFilters state for consistency with other filter modes
  const columnFilters = table.getState().columnFilters;
  
  // Extract ExtendedColumnFilter objects from TanStack value field
  const filters = columnFilters.map(filter => {
    const filterValue = filter.value as any;
    return {
      id: filter.id,
      value: filterValue.value || filterValue.actualValue || filterValue,
      operator: filterValue.operator || 'eq',
      variant: filterValue.variant || 'text',
      filterId: filterValue.filterId || `${filter.id}-${Date.now()}`
    } as ExtendedColumnFilter<TData>;
  });

  const columnMeta = column.columnDef.meta;
  
  // Find existing filter for this column
  const existingFilter = filters.find(f => f.id === column.id);
  const currentValue = existingFilter?.value || '';

  // Helper to add/update filter using TanStack columnFilters
  const updateFilter = React.useCallback((value: string | string[]) => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      // Remove filter
      table.setColumnFilters(columnFilters.filter(f => f.id !== column.id));
      return;
    }

    const newFilter = {
      id: column.id,
      value: {
        operator: columnMeta?.variant === 'text' ? 'iLike' : 'eq',
        variant: columnMeta?.variant ?? "text",
        value,
        actualValue: value,
        filterId: existingFilter?.filterId || generateId({ length: 8 }),
      }
    };

    const otherFilters = columnFilters.filter(f => f.id !== column.id);
    table.setColumnFilters([...otherFilters, newFilter]);
  }, [table, columnFilters, column.id, columnMeta, existingFilter]);

  const onFilterRender = React.useCallback(() => {
    if (!columnMeta?.variant) return null;

    switch (columnMeta.variant) {
      case "text":
        return (
          <Input
            placeholder={columnMeta.placeholder ?? columnMeta.label}
            value={currentValue as string}
            onChange={(event) => updateFilter(event.target.value)}
            className="h-8 w-40 lg:w-56"
          />
        );

        case "number":
          return (
            <div className="relative">
              <Input
                type="number"
                inputMode="numeric"
                placeholder={columnMeta.placeholder ?? columnMeta.label}
                value={currentValue as string}
                onChange={(event) => updateFilter(event.target.value)}
                className={cn("h-8 w-[120px]", columnMeta.unit && "pr-8")}
              />
              {columnMeta.unit && (
                <span className="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-muted-foreground text-sm">
                  {columnMeta.unit}
                </span>
              )}
            </div>
          );

        case "select":
        case "multiSelect":
          return (
            <DataTableFacetedFilter
              column={column}
              table={table}
              title={columnMeta.label ?? column.id}
              options={columnMeta.options ?? []}
              multiple={columnMeta.variant === "multiSelect"}
            />
          );

        case "range":
          return (
            <DataTableSliderFilter
              column={column}
              table={table}
              title={columnMeta.label ?? column.id}
            />
          );

        case "date":
        case "dateRange":
          return (
            <DataTableDateFilter
              column={column}
              table={table}
              title={columnMeta.label ?? column.id}
              multiple={columnMeta.variant === "dateRange"}
            />
          );

        default:
          return null;
      }
    }, [column, columnMeta, currentValue, updateFilter]);

  return onFilterRender();
}
