# Error Handling Implementation Guide

## Overview

This guide provides comprehensive implementation details for error handling UI/UX patterns, extending the core error system defined in `ERROR_HANDLING_GUIDE.md`. It covers all error presentation scenarios, recovery patterns, and user interaction flows.

## Table of Contents

1. [Error Presentation Patterns](#error-presentation-patterns)
2. [Component Error States](#component-error-states)
3. [Error State Decision Matrix](#error-state-decision-matrix)
4. [Loading and Error States](#loading-and-error-states)
5. [Error Recovery Patterns](#error-recovery-patterns)
6. [Implementation Components](#implementation-components)
7. [Usage Examples](#usage-examples)
8. [Testing Error States](#testing-error-states)

## Error Presentation Patterns

### Core Principles

1. **Context-Appropriate**: Errors should be displayed where they occur
2. **Non-Destructive**: Preserve user data and state when possible
3. **Actionable**: Always provide a way forward
4. **Progressive**: Show simple messages with optional details
5. **Accessible**: Follow WCAG guidelines for error presentation

## Component Error States

### 1. Data Table Error State

Replace entire table with error state for loading failures:

```typescript
// src/components/data-table/data-table-error.tsx

import { AlertCircle, WifiOff, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorResponse } from '@/lib/errors/types';
import { handleErrorAction } from '@/lib/errors/client';

interface DataTableErrorProps {
  error: ErrorResponse;
  onRetry?: () => void;
  className?: string;
}

export function DataTableError({ error, onRetry, className }: DataTableErrorProps) {
  const isNetworkError = error.code.startsWith('NET_');
  const isPermissionError = error.code.startsWith('AUTH_');
  
  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-[400px] p-8",
      className
    )}>
      <div className="text-center max-w-md">
        {/* Icon based on error type */}
        {isNetworkError ? (
          <WifiOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        ) : isPermissionError ? (
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        ) : (
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        )}
        
        {/* Error title */}
        <h3 className="text-lg font-semibold mb-2">
          {isNetworkError ? 'Connection Problem' : 
           isPermissionError ? 'Access Denied' : 
           'Unable to Load Data'}
        </h3>
        
        {/* Error message */}
        <p className="text-muted-foreground mb-6">
          {error.message}
        </p>
        
        {/* Actions */}
        <div className="flex gap-3 justify-center">
          {error.retryable && onRetry && (
            <Button onClick={onRetry} variant="default">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
          
          {error.actions?.map((action, index) => (
            <Button
              key={index}
              onClick={() => handleErrorAction(action)}
              variant={index === 0 ? "default" : "outline"}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Skeleton loader for tables
export function DataTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="h-10 bg-muted animate-pulse rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-muted animate-pulse rounded" />
      ))}
    </div>
  );
}

// Empty state for tables
export function DataTableEmpty({ 
  title = "No data",
  description = "No items to display",
  action 
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="text-center max-w-md">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6">{description}</p>
        {action}
      </div>
    </div>
  );
}
```

### 2. Form Error States

Multiple error presentation patterns for forms:

```typescript
// src/components/form/form-error-summary.tsx

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useApiError, useValidationErrors, isValidationError } from '@/lib/errors/hooks';

export function FormErrorSummary({ error }: { error: unknown }) {
  const parsed = useApiError(error);
  const validationErrors = useValidationErrors(error);
  
  // Don't show if only field-level errors
  if (isValidationError(parsed) && validationErrors) {
    const hasGeneralError = parsed.details?.summary;
    if (!hasGeneralError) return null;
  }
  
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {parsed.code === 'VAL_INVALID_FORMAT' ? 'Please check your input' : 'Error'}
      </AlertTitle>
      <AlertDescription>
        {parsed.message}
        
        {/* Show list of field errors if present */}
        {validationErrors && Object.keys(validationErrors).length > 0 && (
          <ul className="mt-2 list-disc list-inside text-sm">
            {Object.entries(validationErrors).map(([field, errors]) => {
              const errorList = Array.isArray(errors) ? errors : [errors];
              return errorList.map((error, index) => (
                <li key={`${field}-${index}`}>
                  <span className="font-medium capitalize">
                    {field.replace(/_/g, ' ')}:
                  </span> {error}
                </li>
              ));
            })}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Form field with error state
export function FormField({ 
  name, 
  label,
  error, 
  children,
  required 
}: {
  name: string;
  label: string;
  error?: unknown;
  children: ReactNode;
  required?: boolean;
}) {
  const fieldError = useFieldError(name, error);
  
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className={cn(fieldError && "error")}>
        {children}
      </div>
      {fieldError && (
        <p className="text-sm text-destructive mt-1" role="alert">
          {Array.isArray(fieldError) ? fieldError[0] : fieldError}
        </p>
      )}
    </div>
  );
}

// Inline validation message
export function InlineValidation({ 
  error,
  warning,
  success 
}: {
  error?: string;
  warning?: string;
  success?: string;
}) {
  if (error) {
    return (
      <p className="text-sm text-destructive mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    );
  }
  
  if (warning) {
    return (
      <p className="text-sm text-warning mt-1 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        {warning}
      </p>
    );
  }
  
  if (success) {
    return (
      <p className="text-sm text-success mt-1 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        {success}
      </p>
    );
  }
  
  return null;
}
```

### 3. Modal/Dialog Error States

Error handling within modal contexts:

```typescript
// src/components/dialog/dialog-with-error.tsx

import { createContext, useContext, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, X } from 'lucide-react';
import { ErrorResponse } from '@/lib/errors/types';

interface ErrorContextValue {
  error: ErrorResponse | null;
  setError: (error: ErrorResponse | null) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

export function useDialogError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useDialogError must be used within DialogWithError');
  }
  return context;
}

export function DialogWithError({ 
  children,
  onError,
  ...props 
}: DialogProps & { 
  onError?: (error: ErrorResponse) => void;
}) {
  const [error, setError] = useState<ErrorResponse | null>(null);
  
  const handleSetError = useCallback((error: ErrorResponse | null) => {
    setError(error);
    if (error && onError) {
      onError(error);
    }
  }, [onError]);
  
  return (
    <Dialog {...props}>
      <DialogContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="pr-8">
              {error.message}
            </AlertDescription>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        )}
        
        <ErrorContext.Provider 
          value={{ 
            error,
            setError: handleSetError,
            clearError: () => setError(null)
          }}
        >
          {children}
        </ErrorContext.Provider>
      </DialogContent>
    </Dialog>
  );
}

// Usage in dialog content
export function CreateItemDialog() {
  const { setError, clearError } = useDialogError();
  
  const mutation = useSafeMutation(createItem, {
    onError: (error) => setError(parseError(error)),
    onSuccess: () => {
      clearError();
      // Close dialog
    }
  });
  
  return (
    <form onSubmit={mutation.mutate}>
      {/* Form fields */}
    </form>
  );
}
```

### 4. Page-Level Error States

Full page error displays:

```typescript
// src/components/page/page-error.tsx

import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ErrorResponse } from '@/lib/errors/types';
import { handleErrorAction } from '@/lib/errors/client';
import { 
  FileQuestion, 
  Lock, 
  ServerCrash, 
  WifiOff,
  AlertTriangle 
} from 'lucide-react';

interface PageErrorProps {
  error: ErrorResponse;
  fullPage?: boolean;
  showBackButton?: boolean;
  customActions?: ReactNode;
}

export function PageError({ 
  error,
  fullPage = false,
  showBackButton = true,
  customActions
}: PageErrorProps) {
  const navigate = useNavigate();
  
  const getIcon = () => {
    if (error.statusCode === 404) return FileQuestion;
    if (error.statusCode === 403) return Lock;
    if (error.statusCode === 500) return ServerCrash;
    if (error.code.startsWith('NET_')) return WifiOff;
    return AlertTriangle;
  };
  
  const getTitle = () => {
    if (error.statusCode === 404) return "Page Not Found";
    if (error.statusCode === 403) return "Access Denied";
    if (error.statusCode === 500) return "Server Error";
    if (error.code.startsWith('AUTH_')) return "Authentication Required";
    if (error.code.startsWith('NET_')) return "Connection Problem";
    return "Something Went Wrong";
  };
  
  const Icon = getIcon();
  
  const content = (
    <div className="text-center">
      <Icon className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
      
      {/* Status code for certain errors */}
      {error.statusCode && [404, 403, 500].includes(error.statusCode) && (
        <div className="text-6xl font-bold text-muted-foreground mb-4">
          {error.statusCode}
        </div>
      )}
      
      <h1 className="text-2xl font-bold mb-2">
        {getTitle()}
      </h1>
      
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        {error.message}
      </p>
      
      {/* Request ID for support */}
      {error.requestId && (
        <p className="text-xs text-muted-foreground mb-6 font-mono">
          Reference: {error.requestId}
        </p>
      )}
      
      <div className="flex gap-4 justify-center">
        {showBackButton && (
          <Button onClick={() => navigate(-1)} variant="outline">
            Go Back
          </Button>
        )}
        
        {error.actions?.map((action, index) => (
          <Button
            key={index}
            onClick={() => handleErrorAction(action)}
            variant={index === 0 ? "default" : "outline"}
          >
            {action.label}
          </Button>
        ))}
        
        {customActions}
      </div>
    </div>
  );
  
  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        {content}
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      {content}
    </div>
  );
}
```

### 5. Inline Error States

For non-blocking errors:

```typescript
// src/components/error/inline-error.tsx

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { ErrorResponse } from '@/lib/errors/types';

interface InlineErrorProps {
  error: ErrorResponse;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function InlineError({ 
  error,
  onDismiss,
  onRetry,
  className,
  compact = false
}: InlineErrorProps) {
  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-2 text-sm text-destructive bg-destructive/10 rounded",
        className
      )}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="flex-1">{error.message}</span>
        {(onRetry || onDismiss) && (
          <div className="flex gap-1">
            {error.retryable && onRetry && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRetry}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
            {onDismiss && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDismiss}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p>{error.message}</p>
          {error.details?.hint && (
            <p className="text-xs mt-1 opacity-90">{error.details.hint}</p>
          )}
        </div>
        {(onRetry || onDismiss) && (
          <div className="flex gap-2 shrink-0">
            {error.retryable && onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button size="icon" variant="ghost" onClick={onDismiss}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

### 6. Card/Widget Error States

For dashboard widgets and cards:

```typescript
// src/components/card/card-error.tsx

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ErrorResponse } from '@/lib/errors/types';

interface CardErrorProps {
  error: ErrorResponse;
  onRetry?: () => void;
  minimal?: boolean;
  title?: string;
}

export function CardError({ 
  error,
  onRetry,
  minimal = false,
  title = "Unable to load"
}: CardErrorProps) {
  if (minimal) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">{error.message}</p>
        {error.retryable && onRetry && (
          <Button size="sm" variant="ghost" onClick={onRetry} className="mt-2">
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <Card className="p-6">
      <div className="flex flex-col items-center text-center">
        <AlertCircle className="w-8 h-8 text-destructive mb-3" />
        <p className="text-sm font-medium mb-1">{title}</p>
        <p className="text-xs text-muted-foreground mb-3">{error.message}</p>
        {error.retryable && onRetry && (
          <Button size="sm" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>
    </Card>
  );
}

// Widget with error boundary
export function DashboardWidget({ 
  title,
  queryKey,
  queryFn,
  render 
}: {
  title: string;
  queryKey: any[];
  queryFn: () => Promise<any>;
  render: (data: any) => ReactNode;
}) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey,
    queryFn,
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <CardSkeleton />}
        {error && <CardError error={parseError(error)} onRetry={refetch} minimal />}
        {data && render(data)}
      </CardContent>
    </Card>
  );
}
```

### 7. Toast Error Notifications

Enhanced toast notifications with actions:

```typescript
// src/components/error/error-toast.tsx

import { toast } from 'sonner';
import { ErrorResponse } from '@/lib/errors/types';
import { handleErrorAction } from '@/lib/errors/client';

export function showErrorToast(
  error: ErrorResponse,
  options?: {
    duration?: number;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  }
) {
  const { duration = 5000, position = 'bottom-right' } = options || {};
  
  // Don't show toast for validation errors
  if (error.code.startsWith('VAL_')) {
    return;
  }
  
  // Custom toast component
  toast.custom(
    (t) => (
      <div className="flex items-start gap-3 p-4 bg-background border rounded-lg shadow-lg">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-sm">{getErrorTitle(error)}</p>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          {error.actions && error.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {error.actions.map((action, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={index === 0 ? "default" : "outline"}
                  onClick={() => {
                    handleErrorAction(action);
                    toast.dismiss(t);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => toast.dismiss(t)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    ),
    {
      duration,
      position,
    }
  );
}

function getErrorTitle(error: ErrorResponse): string {
  if (error.code.startsWith('AUTH_')) return 'Authentication Error';
  if (error.code.startsWith('NET_')) return 'Network Error';
  if (error.code.startsWith('BIZ_')) return 'Operation Failed';
  if (error.code.startsWith('SYS_')) return 'System Error';
  return 'Error';
}
```

## Error State Decision Matrix

| Component Type | Error Type | Presentation | User Actions | Recovery |
|---------------|------------|--------------|--------------|----------|
| **Data Table** | Network Error | Replace table with error state | Retry button | Auto-retry on reconnect |
| | Permission Error | Replace with access denied | Request access / Go back | Redirect to permission request |
| | Empty Result | Show empty state (not error) | Add item / Clear filters | N/A |
| | Partial Load Error | Show data + inline error | Retry failed items | Retry only failed items |
| **Forms** | Validation | Inline field errors + summary | Fix & resubmit | Clear on field change |
| | Submission Error | Alert at top of form | Retry / Contact support | Keep form data |
| | Permission | Disable form + message | Request access | Navigate to access page |
| **Modals** | Any Error | Alert inside modal | Dismiss / Retry | Keep modal open |
| | Fatal Error | Close modal + toast | Show in parent | Reset modal state |
| **Pages** | 404 | Full page error | Go home / Go back | N/A |
| | 403 | Full page access denied | Login / Request access | Redirect after auth |
| | 500 | Full page server error | Retry / Contact support | Auto-retry once |
| **Cards/Widgets** | Load Error | Error in card | Retry / Hide | Auto-retry on visibility |
| | Update Error | Keep data + inline error | Retry / Dismiss | Revert optimistic update |
| **Lists** | Load Error | Replace list with error | Retry | Auto-retry on reconnect |
| | Item Action Error | Keep list + toast | Retry action | Revert optimistic update |
| **Navigation** | Route Error | Error page | Go back | Navigate to safe route |
| | Auth Required | Redirect to login | Login | Return to original route |

## Loading and Error States

### Unified State Handler

```typescript
// src/hooks/use-data-states.ts

import { useState, useCallback, useEffect } from 'react';
import { parseError } from '@/lib/errors/utils';
import { ErrorResponse } from '@/lib/errors/types';

interface DataState<T> {
  data: T | null;
  error: ErrorResponse | null;
  isLoading: boolean;
  isRetrying: boolean;
  isEmpty: boolean;
  hasError: boolean;
}

interface UseDataStatesOptions<T> {
  onError?: (error: ErrorResponse) => void;
  onSuccess?: (data: T) => void;
  retryLimit?: number;
  retryDelay?: number;
  autoRetry?: boolean;
}

export function useDataStates<T>(
  queryFn: () => Promise<T>,
  options: UseDataStatesOptions<T> = {}
) {
  const {
    onError,
    onSuccess,
    retryLimit = 3,
    retryDelay = 1000,
    autoRetry = true,
  } = options;
  
  const [state, setState] = useState<DataState<T>>({
    data: null,
    error: null,
    isLoading: true,
    isRetrying: false,
    isEmpty: false,
    hasError: false,
  });
  
  const [retryCount, setRetryCount] = useState(0);
  
  const fetch = useCallback(async (isRetry = false) => {
    setState(prev => ({
      ...prev,
      isLoading: !isRetry && !prev.data,
      isRetrying: isRetry,
      error: null,
      hasError: false,
    }));
    
    try {
      const data = await queryFn();
      
      setState({
        data,
        error: null,
        isLoading: false,
        isRetrying: false,
        isEmpty: !data || (Array.isArray(data) && data.length === 0),
        hasError: false,
      });
      
      setRetryCount(0);
      onSuccess?.(data);
    } catch (err) {
      const error = parseError(err);
      
      setState(prev => ({
        ...prev,
        error,
        isLoading: false,
        isRetrying: false,
        hasError: true,
      }));
      
      onError?.(error);
      
      // Auto-retry logic
      if (
        autoRetry &&
        error.retryable &&
        retryCount < retryLimit &&
        !isRetry
      ) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetch(true);
        }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
      }
    }
  }, [queryFn, onError, onSuccess, retryCount, retryLimit, retryDelay, autoRetry]);
  
  const retry = useCallback(() => {
    setRetryCount(0);
    fetch(true);
  }, [fetch]);
  
  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: true,
      isRetrying: false,
      isEmpty: false,
      hasError: false,
    });
    setRetryCount(0);
    fetch();
  }, [fetch]);
  
  useEffect(() => {
    fetch();
  }, []);
  
  return {
    ...state,
    retry,
    reset,
    retryCount,
    canRetry: state.error?.retryable && retryCount < retryLimit,
  };
}
```

### State Component Wrapper

```typescript
// src/components/states/state-handler.tsx

import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorResponse } from '@/lib/errors/types';
import { DataTableError } from '../data-table/data-table-error';
import { DataTableEmpty } from '../data-table/data-table-empty';

interface StateHandlerProps<T> {
  data: T | null;
  error: ErrorResponse | null;
  isLoading: boolean;
  isRetrying?: boolean;
  children: (data: T) => ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: (error: ErrorResponse, retry?: () => void) => ReactNode;
  emptyComponent?: ReactNode;
  retryFn?: () => void;
  showRetryingState?: boolean;
}

export function StateHandler<T>({
  data,
  error,
  isLoading,
  isRetrying = false,
  children,
  loadingComponent,
  errorComponent,
  emptyComponent,
  retryFn,
  showRetryingState = true,
}: StateHandlerProps<T>) {
  // Show loading state
  if (isLoading && !isRetrying) {
    return <>{loadingComponent || <DefaultLoadingState />}</>;
  }
  
  // Show retrying state
  if (isRetrying && showRetryingState && data) {
    return (
      <div className="relative">
        <div className="opacity-50">{children(data)}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Retrying...</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error && !isRetrying) {
    return (
      <>
        {errorComponent ? (
          errorComponent(error, retryFn)
        ) : (
          <DataTableError error={error} onRetry={retryFn} />
        )}
      </>
    );
  }
  
  // Show empty state
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return <>{emptyComponent || <DataTableEmpty />}</>;
  }
  
  // Show data
  return <>{children(data)}</>;
}

function DefaultLoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
```

## Error Recovery Patterns

### Automatic Recovery

```typescript
// src/components/error/error-recovery.tsx

import { useState, useEffect, useCallback } from 'react';
import { ErrorResponse } from '@/lib/errors/types';
import { Loader2 } from 'lucide-react';

interface ErrorRecoveryProps {
  error: ErrorResponse;
  children: ReactNode;
  fallback?: ReactNode;
  onRecover?: () => void;
  maxAttempts?: number;
}

export function ErrorRecovery({ 
  error,
  children,
  fallback,
  onRecover,
  maxAttempts = 3
}: ErrorRecoveryProps) {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [attempts, setAttempts] = useState(0);
  
  const attemptRecovery = useCallback(async () => {
    if (attempts >= maxAttempts) return;
    
    setIsRecovering(true);
    setAttempts(prev => prev + 1);
    
    try {
      // Recovery strategies based on error type
      switch (error.code) {
        case 'AUTH_SESSION_EXPIRED':
          // Attempt to refresh session
          await refreshSession();
          break;
          
        case 'NET_CONNECTION_ERROR':
          // Wait for network recovery
          await waitForNetwork();
          break;
          
        case 'SYS_RATE_LIMIT':
          // Wait and retry after rate limit
          await new Promise(resolve => setTimeout(resolve, 5000));
          break;
          
        default:
          // Generic retry for retryable errors
          if (error.retryable) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw new Error('Not recoverable');
          }
      }
      
      setRecovered(true);
      onRecover?.();
    } catch (err) {
      setIsRecovering(false);
      
      // Try again after delay if attempts remaining
      if (attempts < maxAttempts - 1 && error.retryable) {
        setTimeout(() => attemptRecovery(), 3000 * (attempts + 1));
      }
    }
  }, [error, attempts, maxAttempts, onRecover]);
  
  useEffect(() => {
    // Auto-recovery for certain errors
    const autoRecoverableCodes = [
      'AUTH_SESSION_EXPIRED',
      'NET_CONNECTION_ERROR',
      'NET_TIMEOUT'
    ];
    
    if (autoRecoverableCodes.includes(error.code) && !isRecovering) {
      attemptRecovery();
    }
  }, [error.code, attemptRecovery, isRecovering]);
  
  if (recovered) {
    return <>{children}</>;
  }
  
  if (isRecovering) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">
          Attempting to recover...
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Attempt {attempts} of {maxAttempts}
        </p>
      </div>
    );
  }
  
  return <>{fallback || <PageError error={error} />}</>;
}

async function refreshSession() {
  // Implement session refresh logic
  const response = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!response.ok) throw new Error('Failed to refresh session');
}

async function waitForNetwork() {
  return new Promise((resolve, reject) => {
    const checkNetwork = () => {
      if (navigator.onLine) {
        resolve(undefined);
      } else {
        setTimeout(checkNetwork, 1000);
      }
    };
    
    // Timeout after 30 seconds
    setTimeout(() => reject(new Error('Network timeout')), 30000);
    checkNetwork();
  });
}
```

### Progressive Error Disclosure

```typescript
// src/components/error/progressive-error.tsx

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { ErrorResponse } from '@/lib/errors/types';

interface ProgressiveErrorProps {
  error: ErrorResponse;
  showDetails?: boolean;
  className?: string;
}

export function ProgressiveError({ 
  error,
  showDetails: initialShowDetails = false,
  className
}: ProgressiveErrorProps) {
  const [showDetails, setShowDetails] = useState(initialShowDetails);
  const [copied, setCopied] = useState(false);
  
  const copyErrorDetails = () => {
    const details = JSON.stringify({
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      requestId: error.requestId,
      timestamp: error.timestamp,
      details: error.details,
    }, null, 2);
    
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          <p>{error.message}</p>
          
          {/* Toggle details button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDetails(!showDetails)}
            className="h-auto p-0 font-normal"
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Show Details
              </>
            )}
          </Button>
          
          {/* Error details */}
          {showDetails && (
            <div className="mt-3 p-3 bg-background rounded-md border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Error Details</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyErrorDetails}
                  className="h-6 px-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              
              <dl className="text-xs space-y-1">
                <div className="flex gap-2">
                  <dt className="font-medium">Code:</dt>
                  <dd className="font-mono">{error.code}</dd>
                </div>
                
                {error.statusCode && (
                  <div className="flex gap-2">
                    <dt className="font-medium">Status:</dt>
                    <dd>{error.statusCode}</dd>
                  </div>
                )}
                
                {error.requestId && (
                  <div className="flex gap-2">
                    <dt className="font-medium">Request ID:</dt>
                    <dd className="font-mono text-[10px]">{error.requestId}</dd>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <dt className="font-medium">Time:</dt>
                  <dd>{new Date(error.timestamp).toLocaleString()}</dd>
                </div>
                
                {error.details && (
                  <div>
                    <dt className="font-medium mb-1">Additional Info:</dt>
                    <dd>
                      <pre className="text-[10px] overflow-auto max-h-32 p-2 bg-muted rounded">
                        {JSON.stringify(error.details, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
              </dl>
              
              {/* Support message in production */}
              {process.env.NODE_ENV === 'production' && error.requestId && (
                <p className="text-[10px] mt-3 pt-3 border-t">
                  If this problem persists, please contact support with the Request ID above.
                </p>
              )}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

### Offline State Handling

```typescript
// src/components/error/offline-indicator.tsx

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}

export function OfflineIndicator({ className }: { className?: string }) {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  
  useEffect(() => {
    if (isOnline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);
  
  if (isOnline && !showReconnected) return null;
  
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 transition-all duration-300",
        className
      )}
    >
      {!isOnline ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">You're offline</span>
        </div>
      ) : showReconnected ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-lg shadow-lg">
          <Wifi className="w-4 h-4" />
          <span className="text-sm font-medium">Back online</span>
        </div>
      ) : null}
    </div>
  );
}

// Offline-aware query hook
export function useOfflineQuery<T>(
  queryKey: any[],
  queryFn: () => Promise<T>,
  options?: UseQueryOptions<T>
) {
  const isOnline = useOnlineStatus();
  
  return useQuery({
    ...options,
    queryKey: [...queryKey, { offline: !isOnline }],
    queryFn: async () => {
      if (!isOnline) {
        // Try to return cached data
        const cached = queryClient.getQueryData<T>(queryKey);
        if (cached) return cached;
        
        throw new ApiError('NET_CONNECTION_ERROR');
      }
      return queryFn();
    },
    enabled: options?.enabled !== false,
    staleTime: isOnline ? options?.staleTime : Infinity,
    retry: isOnline ? options?.retry : false,
  });
}
```

## Usage Examples

### Example 1: Data Table with Error Handling

```typescript
// src/features/todos/components/todos-table.tsx

import { useDataStates } from '@/hooks/use-data-states';
import { StateHandler } from '@/components/states/state-handler';
import { DataTable } from '@/components/data-table';
import { getTodos } from '../lib/todos.server';

export function TodosTable() {
  const {
    data,
    error,
    isLoading,
    isRetrying,
    retry,
    isEmpty,
  } = useDataStates(() => getTodos(), {
    onError: (error) => {
      // Log to error tracking
      console.error('Failed to load todos:', error);
    },
    autoRetry: true,
    retryLimit: 3,
  });
  
  return (
    <StateHandler
      data={data}
      error={error}
      isLoading={isLoading}
      isRetrying={isRetrying}
      retryFn={retry}
      emptyComponent={
        <DataTableEmpty
          title="No todos yet"
          description="Create your first todo to get started"
          action={
            <Button onClick={() => navigate('/todos/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Todo
            </Button>
          }
        />
      }
    >
      {(todos) => (
        <DataTable
          data={todos}
          columns={columns}
        />
      )}
    </StateHandler>
  );
}
```

### Example 2: Form with Error Handling

```typescript
// src/features/todos/components/create-todo-form.tsx

import { useSafeMutation } from '@/lib/errors/hooks';
import { FormErrorSummary } from '@/components/form/form-error-summary';
import { FormField } from '@/components/form/form-field';
import { createTodo } from '../lib/todos.server';

export function CreateTodoForm() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  
  const mutation = useSafeMutation(
    () => createTodo({ data: formData }),
    {
      onSuccess: () => {
        toast.success('Todo created successfully');
        router.push('/todos');
      },
    }
  );
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      mutation.mutate();
    }}>
      {/* Show general errors */}
      <FormErrorSummary error={mutation.error} />
      
      {/* Form fields with inline errors */}
      <FormField
        name="title"
        label="Title"
        error={mutation.error}
        required
      >
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          disabled={mutation.isPending}
        />
      </FormField>
      
      <FormField
        name="description"
        label="Description"
        error={mutation.error}
      >
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          disabled={mutation.isPending}
        />
      </FormField>
      
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          'Create Todo'
        )}
      </Button>
    </form>
  );
}
```

### Example 3: Page with Error Boundary

```typescript
// src/routes/todos/$todoId.tsx

import { ErrorBoundary } from '@/components/error-boundary';
import { PageError } from '@/components/page/page-error';
import { useQuery } from '@tanstack/react-query';
import { getTodoById } from '@/features/todos/lib/todos.server';

export function TodoDetailPage({ params }: { params: { todoId: string } }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <PageError
          error={error}
          customActions={
            <Button onClick={reset} variant="outline">
              Try Again
            </Button>
          }
        />
      )}
    >
      <TodoDetail todoId={params.todoId} />
    </ErrorBoundary>
  );
}

function TodoDetail({ todoId }: { todoId: string }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['todo', todoId],
    queryFn: () => getTodoById({ id: todoId }),
  });
  
  if (isLoading) {
    return <TodoDetailSkeleton />;
  }
  
  if (error) {
    const parsed = parseError(error);
    
    // Show appropriate error based on type
    if (parsed.statusCode === 404) {
      return (
        <PageError
          error={parsed}
          customActions={
            <Button onClick={() => navigate('/todos')}>
              Back to Todos
            </Button>
          }
        />
      );
    }
    
    return <PageError error={parsed} />;
  }
  
  return <TodoDetailContent todo={data} />;
}
```

## Testing Error States

### Testing Error Components

```typescript
// src/components/data-table/__tests__/data-table-error.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { DataTableError } from '../data-table-error';
import { mockErrors } from '@/lib/errors/testing';

describe('DataTableError', () => {
  it('should display network error correctly', () => {
    const error = mockErrors.networkError().toResponse();
    const onRetry = jest.fn();
    
    render(<DataTableError error={error} onRetry={onRetry} />);
    
    expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
  
  it('should display permission error correctly', () => {
    const error = mockErrors.insufficientPermissions().toResponse();
    
    render(<DataTableError error={error} />);
    
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
  
  it('should show custom actions', () => {
    const error = new ApiError(
      'BIZ_LIMIT_EXCEEDED',
      undefined,
      undefined,
      [{ label: 'Upgrade Plan', action: 'upgrade' }]
    ).toResponse();
    
    render(<DataTableError error={error} />);
    
    expect(screen.getByRole('button', { name: 'Upgrade Plan' })).toBeInTheDocument();
  });
});
```

### Testing Error Recovery

```typescript
// src/components/error/__tests__/error-recovery.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import { ErrorRecovery } from '../error-recovery';
import { mockErrors } from '@/lib/errors/testing';

describe('ErrorRecovery', () => {
  it('should attempt automatic recovery for session errors', async () => {
    const error = mockErrors.sessionExpired().toResponse();
    const onRecover = jest.fn();
    
    // Mock successful session refresh
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    
    render(
      <ErrorRecovery error={error} onRecover={onRecover}>
        <div>Content</div>
      </ErrorRecovery>
    );
    
    // Should show recovering state
    expect(screen.getByText(/attempting to recover/i)).toBeInTheDocument();
    
    // Wait for recovery
    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
    
    expect(onRecover).toHaveBeenCalled();
  });
  
  it('should show fallback after max attempts', async () => {
    const error = mockErrors.networkError().toResponse();
    
    // Mock failed recovery
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    render(
      <ErrorRecovery error={error} maxAttempts={1}>
        <div>Content</div>
      </ErrorRecovery>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    });
  });
});
```

## Best Practices

### 1. Error State Hierarchy
- **Page-level errors**: Use for critical failures
- **Section errors**: Use for feature-specific failures
- **Inline errors**: Use for non-blocking issues
- **Toast errors**: Use for transient issues

### 2. Error Message Guidelines
- **Be specific**: "Unable to save todo" not "Error occurred"
- **Be helpful**: "Check your internet connection" not "Network error"
- **Be concise**: One sentence when possible
- **Be actionable**: Always suggest next steps

### 3. Recovery Strategies
- **Auto-retry**: For transient network issues
- **Manual retry**: For user-initiated actions
- **Graceful degradation**: Show cached data when possible
- **Progressive disclosure**: Hide technical details by default

### 4. Accessibility
- Use proper ARIA attributes
- Announce errors to screen readers
- Provide keyboard navigation for actions
- Ensure sufficient color contrast

### 5. Performance
- Lazy load error components
- Cache error states appropriately
- Debounce retry attempts
- Use optimistic updates where safe

## Conclusion

This comprehensive error handling implementation ensures:

1. **Consistent UX** across all error scenarios
2. **Clear communication** with users
3. **Recovery paths** for all error types
4. **Developer-friendly** testing and debugging
5. **Accessible** error presentation
6. **Performance-conscious** error handling

The system handles everything from network failures to validation errors, providing appropriate UI for each context while maintaining a consistent experience throughout the application.