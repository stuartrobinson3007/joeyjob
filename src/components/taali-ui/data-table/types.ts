import { z } from 'zod'

export type DataTableFilterType =
  | 'text'
  | 'number'
  | 'date'
  | 'dateRange'
  | 'select'
  | 'multiSelect'
  | 'boolean'
  | 'numberRange'
  | 'dynamicSelect'
  | 'dynamicMultiSelect'

export interface DataTableFilterOption {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
  count?: number
}

export interface DataTableFilterConfig {
  type: DataTableFilterType
  title?: string
  options?: DataTableFilterOption[]
  placeholder?: string
  min?: number
  max?: number
  step?: number
  align?: 'start' | 'center' | 'end'
  loadOptions?: () => Promise<{ options: DataTableFilterOption[] }>
}

export interface DataTableColumnMeta {
  filterConfig?: DataTableFilterConfig
  headerClassName?: string
  cellClassName?: string
  enableTextTruncation?: boolean
}

export interface DataTableSearchConfig {
  placeholder?: string
}

export interface DataTablePaginationConfig {
  pageSizeOptions?: number[]
  defaultPageSize?: number
}

export interface DataTableResizingConfig {
  enableColumnResizing?: boolean
  columnResizeMode?: 'onChange' | 'onEnd'
  columnResizeDirection?: 'ltr' | 'rtl'
}

export interface DataTableLoadingConfig {
  skeletonRowCount?: number
  showSkeletonOnRefetch?: boolean
}

export interface DataTableConfig<TData = unknown> {
  searchConfig?: DataTableSearchConfig
  paginationConfig?: DataTablePaginationConfig
  selectionConfig?: DataTableSelectionConfig
  resizingConfig?: DataTableResizingConfig
  loadingConfig?: DataTableLoadingConfig
  enableColumnFilters?: boolean
  enableSorting?: boolean
  enableRowSelection?: boolean
  manualFiltering?: boolean
  manualPagination?: boolean
  manualSorting?: boolean
  _dataType?: TData // Phantom type to use TData parameter
}

export interface DataTableState {
  search: string
  columnFilters: Array<{
    id: string
    value: unknown
  }>
  sorting: Array<{
    id: string
    desc: boolean
  }>
  pagination: {
    pageIndex: number
    pageSize: number
  }
}

export interface SelectionState {
  selectedIds: Set<string>
  isAllSelected: boolean
  totalSelectedCount: number
}

export interface DataTableSelectionConfig {
  enableBulkActions?: boolean
  bulkActions?: BulkAction[]
}

export interface BulkAction {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  onClick: (selectedIds: string[], isAllSelected: boolean) => void | Promise<void>
  disabled?: boolean
}

export interface ServerQueryParams {
  search?: string
  filters?: Record<string, unknown>
  sorting?: Array<{ id: string; desc: boolean }>
  pagination?: {
    pageIndex: number
    pageSize: number
  }
}

export interface ServerQueryResponse<TData> {
  data: TData[]
  totalCount: number
  pageCount: number
}

export const filterOperatorSchema = z.enum([
  'eq',
  'neq',
  'contains',
  'startsWith',
  'endsWith',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'in',
  'notIn',
  'isNull',
  'isNotNull',
])

export type FilterOperator = z.infer<typeof filterOperatorSchema>

export interface FilterValue {
  operator: FilterOperator
  value: unknown
}

export interface ColumnFilter {
  id: string
  value: unknown
}
