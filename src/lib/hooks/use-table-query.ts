import { useQuery, UseQueryOptions } from "@tanstack/react-query"
import { useState, useCallback, useMemo, useEffect } from "react"
import { DataTableState, ServerQueryParams, ServerQueryResponse } from "@/components/data-table/types"

interface UseTableQueryOptions<TData> {
  queryKey: string[]
  queryFn: (params: ServerQueryParams) => Promise<ServerQueryResponse<TData>>
  defaultPageSize?: number
  debounceMs?: number
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number | false
}

export function useTableQuery<TData>({
  queryKey,
  queryFn,
  defaultPageSize = 10,
  debounceMs = 300,
  enabled = true,
  staleTime = 1000 * 60, // 1 minute
  refetchInterval = false,
}: UseTableQueryOptions<TData>) {
  const [tableState, setTableState] = useState<DataTableState>({
    search: "",
    columnFilters: [],
    sorting: [],
    pagination: {
      pageIndex: 0,
      pageSize: defaultPageSize,
    },
  })

  const [debouncedState, setDebouncedState] = useState(tableState)

  // Debounce state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedState(tableState)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [tableState, debounceMs])

  // Convert table state to server query params
  const serverParams = useMemo<ServerQueryParams>(() => {
    const filters: Record<string, any> = {}
    
    // Add column filters (including search which is set as a column filter)
    debouncedState.columnFilters.forEach((filter) => {
      if (filter.value !== undefined && filter.value !== '') {
        filters[filter.id] = filter.value
      }
    })
    
    // Also check for global filter
    const searchValue = debouncedState.search || 
      (debouncedState.columnFilters.find(f => f.id === 'title')?.value as string) || ''

    return {
      search: searchValue,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sorting: debouncedState.sorting.length > 0 ? debouncedState.sorting : undefined,
      pagination: debouncedState.pagination,
    }
  }, [debouncedState])

  // Create query key with params
  const fullQueryKey = useMemo(
    () => [...queryKey, serverParams],
    [queryKey, serverParams]
  )

  // Fetch data
  const query = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => queryFn(serverParams),
    enabled,
    staleTime,
    refetchInterval,
    placeholderData: (previousData) => previousData,
  } as UseQueryOptions<ServerQueryResponse<TData>, Error>)

  // Handler for state changes from DataTable
  const handleStateChange = useCallback((newState: Partial<DataTableState>) => {
    setTableState((prev) => ({
      ...prev,
      ...newState,
    }))
  }, [])

  // Reset filters
  const resetFilters = useCallback(() => {
    setTableState((prev) => ({
      ...prev,
      search: "",
      columnFilters: [],
      sorting: [],
      pagination: {
        ...prev.pagination,
        pageIndex: 0,
      },
    }))
  }, [])

  // Set specific filter
  const setFilter = useCallback((columnId: string, value: any) => {
    setTableState((prev) => {
      const existingFilterIndex = prev.columnFilters.findIndex(
        (filter) => filter.id === columnId
      )

      let newFilters = [...prev.columnFilters]

      if (value === undefined || value === null) {
        // Remove filter
        if (existingFilterIndex !== -1) {
          newFilters.splice(existingFilterIndex, 1)
        }
      } else {
        // Add or update filter
        if (existingFilterIndex !== -1) {
          newFilters[existingFilterIndex] = { id: columnId, value }
        } else {
          newFilters.push({ id: columnId, value })
        }
      }

      return {
        ...prev,
        columnFilters: newFilters,
        pagination: {
          ...prev.pagination,
          pageIndex: 0, // Reset to first page when filters change
        },
      }
    })
  }, [])

  return {
    data: query.data?.data || [],
    totalCount: query.data?.totalCount || 0,
    pageCount: query.data?.pageCount || 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    tableState,
    onStateChange: handleStateChange,
    resetFilters,
    setFilter,
  }
}