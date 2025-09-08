import '@tanstack/react-table'
import type { DataTableColumnMeta } from '@/taali/components/data-table/types'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends import('@tanstack/react-table').RowData, TValue> extends DataTableColumnMeta {}
}