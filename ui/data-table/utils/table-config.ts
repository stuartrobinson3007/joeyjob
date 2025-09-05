/**
 * Table Configuration System
 * 
 * Centralized table configuration for consistent behavior across apps.
 * Adapted from tnks-data-table for better developer experience.
 */

export interface TableConfig {
  // Enable/disable row selection
  enableRowSelection: boolean;
  
  // Enable/disable keyboard navigation
  enableKeyboardNavigation: boolean;
  
  // Enable/disable clicking a row to select it
  enableClickRowSelect: boolean;
  
  // Enable/disable pagination
  enablePagination: boolean;
  
  // Enable/disable search
  enableSearch: boolean;
  
  // Enable/disable column filters
  enableColumnFilters: boolean;
  
  // Enable/disable date range filter
  enableDateFilter: boolean;
  
  // Enable/disable column visibility options
  enableColumnVisibility: boolean;
  
  // Enable/disable URL state persistence
  enableUrlState: boolean;
  
  // Enable/disable column resizing
  enableColumnResizing: boolean;
  
  // Enable/disable toolbar
  enableToolbar: boolean;
  
  // Control the size of buttons and inputs throughout the table
  size: 'sm' | 'default' | 'lg';
  
  // Unique ID for storing column sizing in localStorage
  columnResizingTableId?: string;
  
  // Custom placeholder text for search input
  searchPlaceholder?: string;
}

// Default table configuration
export const defaultTableConfig: TableConfig = {
  enableRowSelection: true,
  enableKeyboardNavigation: true,
  enableClickRowSelect: false,
  enablePagination: true,
  enableSearch: true,
  enableColumnFilters: true,
  enableDateFilter: false,
  enableColumnVisibility: true,
  enableUrlState: false,
  enableColumnResizing: true,
  enableToolbar: true,
  size: 'default',
  searchPlaceholder: 'Search...',
};

// Simple table configuration (like Teams page)
export const simpleTableConfig: TableConfig = {
  enableRowSelection: false,
  enableKeyboardNavigation: true,
  enableClickRowSelect: false,
  enablePagination: true,
  enableSearch: true,
  enableColumnFilters: true,
  enableDateFilter: false,
  enableColumnVisibility: true,
  enableUrlState: false,
  enableColumnResizing: false,
  enableToolbar: true,
  size: 'default',
  searchPlaceholder: 'Search...',
};

// Advanced table configuration (like Todos page)
export const advancedTableConfig: TableConfig = {
  enableRowSelection: true,
  enableKeyboardNavigation: true,
  enableClickRowSelect: true,
  enablePagination: true,
  enableSearch: true,
  enableColumnFilters: true,
  enableDateFilter: true,
  enableColumnVisibility: true,
  enableUrlState: true,
  enableColumnResizing: true,
  enableToolbar: true,
  size: 'default',
  searchPlaceholder: 'Search...',
};

/**
 * Hook to merge user config with defaults
 */
export function useTableConfig(userConfig: Partial<TableConfig> = {}): TableConfig {
  return {
    ...defaultTableConfig,
    ...userConfig,
  };
}