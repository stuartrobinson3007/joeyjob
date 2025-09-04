/**
 * Standardized Filter Component Interfaces
 * 
 * Common prop interfaces for all filter components to ensure consistency.
 */

import type { Column, Table } from '@tanstack/react-table';

/**
 * Base props for all filter components
 */
export interface BaseFilterProps<T> {
  column: Column<T>;
  table: Table<T>;
  title?: string;
}

/**
 * Props for select/multiSelect filter components
 */
export interface SelectFilterProps<T> extends BaseFilterProps<T> {
  options: Array<{
    value: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    count?: number;
  }>;
  multiple?: boolean;
}

/**
 * Props for date filter components
 */
export interface DateFilterProps<T> extends BaseFilterProps<T> {
  multiple?: boolean;
}

/**
 * Props for range/slider filter components  
 */
export interface RangeFilterProps<T> extends BaseFilterProps<T> {
  // Range-specific props can be added here
}