/**
 * Data Table Date Filter
 * 
 * Professional date and date range filtering component.
 * Supports both single date and date range selection.
 */

import type { Column, Table } from "@tanstack/react-table";
import { useFilterState, updateColumnFilter, removeColumnFilter } from "taali/frontend";
import { CalendarIcon, XCircle } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";

import { Button } from "../button";
import { Calendar } from "../calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../popover";
import { Separator } from "../separator";

type DateSelection = Date[] | DateRange;

function getIsDateRange(value: DateSelection): value is DateRange {
  return value && typeof value === "object" && !Array.isArray(value);
}

function parseAsDate(timestamp: number | string | undefined): Date | undefined {
  if (!timestamp) return undefined;
  const numericTimestamp =
    typeof timestamp === "string" ? Number(timestamp) : timestamp;
  const date = new Date(numericTimestamp);
  return !Number.isNaN(date.getTime()) ? date : undefined;
}

function parseColumnFilterValue(value: unknown) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "number" || typeof item === "string") {
        return item;
      }
      return undefined;
    });
  }

  if (typeof value === "string" || typeof value === "number") {
    return [value];
  }

  return [];
}

interface DataTableDateFilterProps<TData> {
  column: Column<TData, unknown>;
  table: Table<TData>;
  title?: string;
  multiple?: boolean;
}

export function DataTableDateFilter<TData>({
  column,
  table,
  title,
  multiple = false,
}: DataTableDateFilterProps<TData>) {
  // Use unified filter state pattern
  const filterState = useFilterState(table, column.id);
  const columnFilterValue = filterState.value;

  const selectedDates = React.useMemo<DateSelection>(() => {
    if (!columnFilterValue) {
      return multiple ? { from: undefined, to: undefined } : [];
    }

    if (multiple) {
      const timestamps = parseColumnFilterValue(columnFilterValue);
      return {
        from: parseAsDate(timestamps[0]),
        to: parseAsDate(timestamps[1]),
      };
    }

    const timestamps = parseColumnFilterValue(columnFilterValue);
    const date = parseAsDate(timestamps[0]);
    return date ? [date] : [];
  }, [columnFilterValue, multiple]);

  const onSelect = React.useCallback(
    (date: Date | DateRange | undefined) => {
      if (!date) {
        removeColumnFilter(table, column.id);
        return;
      }

      let dateValues: number[];
      let operator: string;

      if (multiple && !("getTime" in date)) {
        const from = date.from?.getTime();
        const to = date.to?.getTime();
        dateValues = [from, to].filter(Boolean) as number[];
        operator = 'isBetween';
      } else if (!multiple && "getTime" in date) {
        dateValues = [date.getTime()];
        operator = 'eq';
      } else {
        return;
      }

      updateColumnFilter(
        table, 
        column.id, 
        dateValues, 
        operator, 
        multiple ? 'dateRange' : 'date'
      );
    },
    [column, table, multiple],
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      removeColumnFilter(table, column.id);
    },
    [table, column],
  );

  const formatDateDisplay = () => {
    if (multiple && getIsDateRange(selectedDates)) {
      const { from, to } = selectedDates;
      if (from && to) {
        return `${format(from, "MMM dd")} - ${format(to, "MMM dd, yyyy")}`;
      }
      if (from) {
        return `From ${format(from, "MMM dd, yyyy")}`;
      }
      return title;
    }
    
    if (!multiple && Array.isArray(selectedDates) && selectedDates[0]) {
      return format(selectedDates[0], "MMM dd, yyyy");
    }
    
    return title;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          {columnFilterValue ? (
            <div
              role="button"
              aria-label={`Clear ${title} filter`}
              tabIndex={0}
              onClick={onReset}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
            >
              <XCircle />
            </div>
          ) : (
            <CalendarIcon />
          )}
          {formatDateDisplay()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode={multiple ? "range" : "single"}
          selected={selectedDates as any}
          onSelect={onSelect}
          numberOfMonths={multiple ? 2 : 1}
          initialFocus
          required={false}
        />
        {columnFilterValue as any && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onReset}
              >
                Clear
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}