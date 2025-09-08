import { useCallback, useRef, useEffect } from 'react'

import { validationMessages } from '@/lib/validation/validation-messages'

/**
 * Hook for async field validation with proper race condition handling
 * 
 * Features:
 * - Cancels in-flight validations when new ones start
 * - Returns valid if validation was cancelled (prevents stale errors)
 * - Cleans up on unmount
 * - Handles errors gracefully
 * 
 * @param validationFn - Async function that returns true or an error message
 * @param deps - Dependencies for the validation function
 */
export function useAsyncFieldValidator<T>(
  validationFn: (value: T, signal?: AbortSignal) => Promise<boolean | string>,
  deps: React.DependencyList = []
) {
  const abortControllerRef = useRef<AbortController | undefined>(undefined)
  
  const validate = useCallback(async (value: T) => {
    // Cancel any in-flight validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new controller for this validation
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    
    try {
      const result = await validationFn(value, signal)
      
      // Check if this validation was cancelled
      if (signal.aborted) {
        return true // Return valid if cancelled (don't show stale errors)
      }
      
      return result
    } catch (error: unknown) {
      // Handle abort errors gracefully
      if ((error as Error)?.name === 'AbortError') {
        return true // Valid if aborted
      }
      
      // Return a user-friendly error message for unexpected errors
      return validationMessages.common.validationFailed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are passed as spread parameter
  }, [validationFn, ...deps])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  return validate
}

/**
 * Create a debounced async validator for React Hook Form
 * 
 * @param validationFn - The validation function
 * @param debounceMs - Debounce delay in milliseconds
 * @param deps - Dependencies for the validation function
 */
export function useDebouncedAsyncValidator<T>(
  validationFn: (value: T, signal?: AbortSignal) => Promise<boolean | string>,
  debounceMs: number = 500,
  deps: React.DependencyList = []
) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const validator = useAsyncFieldValidator(validationFn, deps)
  
  const debouncedValidate = useCallback((value: T) => {
    return new Promise<boolean | string>((resolve) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Set new timeout
      timeoutRef.current = setTimeout(async () => {
        const result = await validator(value)
        resolve(result)
      }, debounceMs)
    })
  }, [validator, debounceMs])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return debouncedValidate
}