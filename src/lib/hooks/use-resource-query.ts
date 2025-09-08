import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { useErrorHandler } from '@/lib/errors/hooks'

interface UseResourceQueryOptions<TData> {
  queryKey: unknown[]
  queryFn: () => Promise<TData>
  enabled?: boolean
  redirectOnError?: boolean | string
  onError?: (error: unknown) => void
  retry?: number
  staleTime?: number
}

/**
 * Hook for critical single resources that are essential for the page to function.
 * Shows toast error and optionally redirects on failure.
 * 
 * Use this for:
 * - Individual todo/item details
 * - User profiles
 * - Organization details
 * - Any resource where the page can't function without it
 */
export function useResourceQuery<TData>({
  queryKey,
  queryFn,
  enabled = true,
  redirectOnError = false,
  onError,
  retry = 2,
  staleTime = 5 * 60 * 1000
}: UseResourceQueryOptions<TData>) {
  const navigate = useNavigate()
  const { showError } = useErrorHandler()
  
  return useQuery({
    queryKey,
    queryFn,
    enabled,
    retry,
    staleTime,
    onError: (error: Error) => {
      showError(error)
      onError?.(error)
      
      if (redirectOnError) {
        const path = typeof redirectOnError === 'string' 
          ? redirectOnError 
          : '/'
        navigate({ to: path })
      }
    }
  } as UseQueryOptions<TData>)
}