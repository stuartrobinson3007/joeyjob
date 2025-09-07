import type { ServerQueryParams } from '@/components/data-table/types'

/**
 * Todo Query Keys Factory
 * Following TanStack Query best practices for hierarchical query key structure
 * Structure: Generic → Specific (todos → orgId → operation → params)
 */
export const todoKeys = {
  // Base key for all todo-related queries in an organization
  all: (orgId: string) => ['todos', orgId] as const,
  
  // Table/list queries
  tables: (orgId: string) => [...todoKeys.all(orgId), 'table'] as const,
  table: (orgId: string, params?: ServerQueryParams) => 
    params 
      ? [...todoKeys.tables(orgId), params] as const
      : todoKeys.tables(orgId),
  
  // Individual todo queries  
  details: (orgId: string) => [...todoKeys.all(orgId), 'detail'] as const,
  detail: (orgId: string, id: string) => [...todoKeys.details(orgId), id] as const,
  
  // Utility queries
  creators: (orgId: string) => [...todoKeys.all(orgId), 'creators'] as const,
  allIds: (orgId: string, filters?: any) => 
    filters
      ? [...todoKeys.all(orgId), 'allIds', filters] as const
      : [...todoKeys.all(orgId), 'allIds'] as const,
}

/**
 * Usage Examples:
 * 
 * // Invalidate ALL todo queries for an organization
 * queryClient.invalidateQueries({ queryKey: todoKeys.all(orgId) })
 * 
 * // Invalidate only table queries
 * queryClient.invalidateQueries({ queryKey: todoKeys.tables(orgId) })
 * 
 * // Invalidate specific table query with params
 * queryClient.invalidateQueries({ queryKey: todoKeys.table(orgId, params) })
 * 
 * // Invalidate only detail queries
 * queryClient.invalidateQueries({ queryKey: todoKeys.details(orgId) })
 */