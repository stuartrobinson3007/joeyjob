import React from 'react'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'

import { ErrorBoundary } from '@/components/error-boundary'
import { Button } from '@/components/taali-ui/ui/button'


interface FormErrorBoundaryProps {
  children: React.ReactNode
  onError?: (error: Error) => void
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
  showToast?: boolean
}

/**
 * Error boundary specifically for forms
 * 
 * Features:
 * - Catches render errors in form components
 * - Shows user-friendly fallback UI
 * - Optional toast notification
 * - Custom fallback component support
 */
export function FormErrorBoundary({ 
  children, 
  onError,
  fallback: FallbackComponent,
  showToast = true
}: FormErrorBoundaryProps) {
  const handleError = React.useCallback((error: any, reset: () => void) => {
    console.error('Form rendering error:', error)
    
    // Show toast for render errors
    if (showToast) {
      toast.error('Form failed to load', {
        description: 'Please refresh the page and try again'
      })
    }
    
    // Call custom error handler
    onError?.(error)
    
    // Render fallback component
    const Component = FallbackComponent || FormErrorFallback
    return <Component error={error} reset={reset} />
  }, [onError, FallbackComponent, showToast])
  
  return (
    <ErrorBoundary fallback={handleError}>
      {children}
    </ErrorBoundary>
  )
}

/**
 * Default fallback component for form errors
 */
function FormErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 border border-destructive/30 rounded-lg bg-destructive/5">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-destructive">Form Error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The form encountered an error and cannot be displayed.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Error details (development only)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                {error.message}
              </pre>
            </details>
          )}
          <Button 
            onClick={reset} 
            className="mt-4" 
            variant="outline"
            size="sm"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
}