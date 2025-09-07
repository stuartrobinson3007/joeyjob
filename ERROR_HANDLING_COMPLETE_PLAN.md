# Complete Error Handling Implementation Plan (Items 1-15)

## Executive Summary

This document outlines the implementation of a comprehensive error handling system covering the first 15 priority items identified as essential and recommended for the application. The implementation will transform inconsistent error handling into a robust, type-safe, user-friendly system.

## Scope

### Core Essentials (Items 1-7)
1. Basic Error Class Structure
2. Error Parsing Utility
3. Server-Side Error Middleware
4. Client-Side Toast Notifications
5. Form Validation Error Display
6. Table/List Error States
7. Basic Error Boundary

### Recommended Additions (Items 8-15)
8. Typed Error Codes System
9. Enhanced Server Function Wrapper
10. React Error Hooks
11. QueryClient Global Error Config
12. Error Recovery Actions
13. Page-Level Error Components
14. Loading State Management
15. Form Error Summary

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Components                       │
├─────────────────────────────────────────────────────────────┤
│  Error Boundary → Error Hooks → Toast Handler → UI States   │
│                           ↓                                  │
│                    QueryClient (Global Config)               │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP
┌─────────────────────────────────────────────────────────────┐
│                      Server Functions                        │
├─────────────────────────────────────────────────────────────┤
│  Server Handler → Error Middleware → ApiError → Response    │
│                           ↓                                  │
│                    Error Codes Registry                      │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Implementation Plan

### Phase 1: Core Infrastructure (Day 1-3)

#### 1. Basic Error Class Structure

**File**: `src/lib/errors/api-error.ts`

```typescript
import { ErrorResponse, ErrorAction } from './types';

export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number = 500,
    public details?: any,
    public userMessage?: string,
    public actions?: ErrorAction[]
  ) {
    super(userMessage || 'An error occurred');
    this.name = 'ApiError';
  }

  toResponse(requestId?: string): ErrorResponse {
    return {
      code: this.code,
      message: this.userMessage || this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: new Date().toISOString(),
      requestId,
      retryable: this.isRetryable(),
      actions: this.actions || []
    };
  }

  private isRetryable(): boolean {
    // Server errors and network errors are retryable
    return this.statusCode >= 500 || this.code.startsWith('NET_');
  }

  // Static factory methods
  static validation(fields: Record<string, string | string[]>, summary?: string): ApiError {
    return new ApiError(
      'VAL_INVALID_FORMAT',
      400,
      { fields, summary },
      summary || 'Please check the highlighted fields'
    );
  }

  static notFound(resource: string): ApiError {
    return new ApiError(
      'BIZ_NOT_FOUND',
      404,
      { resource },
      `${resource} not found`
    );
  }

  static permission(action?: string): ApiError {
    return new ApiError(
      'AUTH_INSUFFICIENT_PERMISSIONS',
      403,
      { action },
      action ? `You don't have permission to ${action}` : 'Permission denied'
    );
  }
}
```

**File**: `src/lib/errors/types.ts`

```typescript
export interface ErrorResponse {
  code: string;
  message: string;
  statusCode?: number;
  details?: any;
  timestamp: string;
  requestId?: string;
  retryable: boolean;
  actions?: ErrorAction[];
}

export interface ErrorAction {
  label: string;
  action: string;
  data?: any;
}

export interface ValidationErrorDetails {
  fields: Record<string, string | string[]>;
  summary?: string;
}
```

#### 2. Error Parsing Utility

**File**: `src/lib/errors/utils.ts`

```typescript
import { ErrorResponse } from './types';
import { ApiError } from './api-error';

export function parseError<T = unknown>(error: unknown): ErrorResponse & { details?: T } {
  // Already in correct format
  if (isErrorResponse(error)) {
    return error as ErrorResponse & { details?: T };
  }

  // ApiError instance
  if (error instanceof ApiError) {
    return error.toResponse();
  }

  // Network error
  if (isNetworkError(error)) {
    return {
      code: 'NET_CONNECTION_ERROR',
      message: 'Connection problem. Please check your internet and try again',
      statusCode: 0,
      timestamp: new Date().toISOString(),
      retryable: true,
      actions: [{ label: 'Retry', action: 'retry' }]
    };
  }

  // Standard Error object
  if (error instanceof Error) {
    return {
      code: 'SYS_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Something went wrong. Please try again',
      statusCode: 500,
      timestamp: new Date().toISOString(),
      retryable: true,
      actions: []
    };
  }

  // Unknown error
  return {
    code: 'SYS_SERVER_ERROR',
    message: 'An unexpected error occurred',
    statusCode: 500,
    timestamp: new Date().toISOString(),
    retryable: true,
    actions: []
  };
}

export function isErrorResponse(error: unknown): error is ErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  if (typeof error === 'object' && 'statusCode' in error) {
    return (error as any).statusCode === 0;
  }
  
  return false;
}

export function isValidationError(error: ErrorResponse): boolean {
  return error.code.startsWith('VAL_');
}

export function isAuthError(error: ErrorResponse): boolean {
  return error.code.startsWith('AUTH_');
}
```

#### 3. Server-Side Error Middleware

**File**: `src/lib/errors/middleware.ts`

```typescript
import { createMiddleware } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';
import { ApiError } from './api-error';
import { parseError } from './utils';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const errorMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    const request = getWebRequest();
    const requestId = nanoid(10);
    
    try {
      return await next({
        context: { requestId }
      });
    } catch (error) {
      // Log error server-side
      console.error(`[${requestId}] Error:`, {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        url: request.url,
        method: request.method
      });
      
      // Transform to ApiError if needed
      if (error instanceof ApiError) {
        throw error.toResponse(requestId);
      }
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const fields: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!fields[path]) fields[path] = [];
          fields[path].push(err.message);
        });
        
        throw ApiError.validation(fields).toResponse(requestId);
      }
      
      // Parse unknown errors
      const parsed = parseError(error);
      throw {
        ...parsed,
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  });

// Enhanced createServerFn wrapper
export function createServerFn<TInput = void, TOutput = any>(
  options: {
    method?: 'GET' | 'POST';
    middleware?: any[];
    validator?: (input: unknown) => TInput;
  } = {}
) {
  const baseCreateServerFn = require('@tanstack/react-start').createServerFn;
  
  const middlewares = [
    ...(options.middleware || []),
    errorMiddleware
  ];
  
  return baseCreateServerFn({
    method: options.method || 'POST'
  })
    .middleware(middlewares)
    .validator(options.validator || ((x: unknown) => x as TInput));
}
```

#### 4. Client-Side Toast Notifications

**File**: `src/lib/errors/client.ts`

```typescript
import { toast } from 'sonner';
import { parseError } from './utils';
import { ErrorResponse, ErrorAction } from './types';

export function handleApiError(
  error: unknown,
  options?: {
    silent?: boolean;
    fallbackMessage?: string;
  }
) {
  const parsed = parseError(error);
  
  // Don't show toast for validation errors (handle inline)
  if (parsed.code.startsWith('VAL_') && !options?.fallbackMessage) {
    return parsed;
  }
  
  // Don't show toast if silent
  if (options?.silent) {
    return parsed;
  }
  
  // Show error toast
  showErrorToast(parsed, options?.fallbackMessage);
  
  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', parsed);
  }
  
  return parsed;
}

export function showErrorToast(
  error: ErrorResponse,
  fallbackMessage?: string
) {
  const message = fallbackMessage || error.message;
  
  // Handle actions
  if (error.actions && error.actions.length > 0) {
    const primaryAction = error.actions[0];
    
    toast.error(message, {
      action: {
        label: primaryAction.label,
        onClick: () => handleErrorAction(primaryAction)
      },
      duration: 5000
    });
  } else {
    toast.error(message, {
      duration: 4000
    });
  }
}

export function handleErrorAction(action: ErrorAction) {
  switch (action.action) {
    case 'retry':
      window.location.reload();
      break;
      
    case 'login':
      window.location.href = '/auth/signin';
      break;
      
    case 'upgrade':
      window.location.href = '/billing';
      break;
      
    case 'support':
      window.location.href = '/support';
      break;
      
    default:
      if (action.data?.href) {
        window.location.href = action.data.href;
      }
  }
}
```

#### 5. Form Validation Error Display

**File**: `src/components/form/form-field-error.tsx`

```typescript
import { useFieldError } from '@/lib/errors/hooks';

interface FormFieldErrorProps {
  name: string;
  error: unknown;
  className?: string;
}

export function FormFieldError({ name, error, className }: FormFieldErrorProps) {
  const fieldError = useFieldError(name, error);
  
  if (!fieldError) return null;
  
  const errors = Array.isArray(fieldError) ? fieldError : [fieldError];
  
  return (
    <div className={className}>
      {errors.map((err, index) => (
        <p key={index} className="text-sm text-destructive mt-1" role="alert">
          {err}
        </p>
      ))}
    </div>
  );
}
```

#### 6. Table/List Error States

**File**: `src/components/data-table/data-table-error.tsx`

```typescript
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
              <RefreshCw  />
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
```

#### 7. Basic Error Boundary

**File**: `src/components/error-boundary.tsx` (Update existing)

```typescript
import { Component, ReactNode } from 'react';
import { parseError } from '@/lib/errors/utils';
import { handleApiError } from '@/lib/errors/client';
import { ErrorResponse } from '@/lib/errors/types';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: ErrorResponse, reset: () => void) => ReactNode;
  onError?: (error: ErrorResponse) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: ErrorResponse | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const parsed = parseError(error);
    return { hasError: true, error: parsed };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const parsed = parseError(error);
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught:');
      console.error('Error:', error);
      console.error('Parsed:', parsed);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
    
    // Handle error
    handleApiError(parsed);
    
    // Call custom handler
    this.props.onError?.(parsed);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-destructive mb-4">
              Something went wrong
            </h2>
            <p className="text-muted-foreground mb-6">
              {this.state.error.message}
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-muted-foreground mb-4 font-mono">
                Error Code: {this.state.error.code}
              </p>
            )}
            
            <Button onClick={this.reset}>Try Again</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Phase 2: Enhanced Features (Day 4-7)

#### 8. Typed Error Codes System

**File**: `src/lib/errors/codes.ts`

```typescript
export const ErrorCodes = {
  // Authentication & Authorization (AUTH_*)
  AUTH_INVALID_CREDENTIALS: {
    defaultMessage: 'Invalid email or password',
    statusCode: 401,
    retryable: false
  },
  AUTH_SESSION_EXPIRED: {
    defaultMessage: 'Your session has expired. Please sign in again',
    statusCode: 401,
    retryable: false,
    actions: [{ label: 'Sign In', action: 'login' }]
  },
  AUTH_INSUFFICIENT_PERMISSIONS: {
    defaultMessage: "You don't have permission to perform this action",
    statusCode: 403,
    retryable: false
  },
  
  // Validation Errors (VAL_*)
  VAL_REQUIRED_FIELD: {
    defaultMessage: 'This field is required',
    statusCode: 400,
    retryable: false
  },
  VAL_INVALID_FORMAT: {
    defaultMessage: 'Please enter a valid format',
    statusCode: 400,
    retryable: false
  },
  VAL_INVALID_EMAIL: {
    defaultMessage: 'Please enter a valid email address',
    statusCode: 400,
    retryable: false
  },
  
  // Business Logic Errors (BIZ_*)
  BIZ_LIMIT_EXCEEDED: {
    defaultMessage: "You've reached your plan limit",
    statusCode: 403,
    retryable: false,
    actions: [{ label: 'Upgrade Plan', action: 'upgrade' }]
  },
  BIZ_DUPLICATE_ENTRY: {
    defaultMessage: 'This item already exists',
    statusCode: 409,
    retryable: false
  },
  BIZ_NOT_FOUND: {
    defaultMessage: 'The requested item was not found',
    statusCode: 404,
    retryable: false
  },
  
  // System Errors (SYS_*)
  SYS_SERVER_ERROR: {
    defaultMessage: "Something went wrong. We're working on it",
    statusCode: 500,
    retryable: true,
    actions: [{ label: 'Try Again', action: 'retry' }]
  },
  SYS_RATE_LIMIT: {
    defaultMessage: "You're making too many requests. Please slow down",
    statusCode: 429,
    retryable: true
  },
  
  // Network Errors (NET_*)
  NET_CONNECTION_ERROR: {
    defaultMessage: 'Connection problem. Please check your internet and try again',
    statusCode: 0,
    retryable: true,
    actions: [{ label: 'Retry', action: 'retry' }]
  },
  NET_TIMEOUT: {
    defaultMessage: 'The request took too long. Please try again',
    statusCode: 408,
    retryable: true,
    actions: [{ label: 'Retry', action: 'retry' }]
  }
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
```

#### 9. Enhanced Server Function Wrapper

Update `src/lib/errors/middleware.ts` to include Better Auth error transformation:

```typescript
// Add to existing middleware
export function transformAuthError(error: any): ApiError {
  // Transform Better Auth errors
  if (error.code === 'INVALID_CREDENTIALS') {
    return new ApiError('AUTH_INVALID_CREDENTIALS');
  }
  
  if (error.code === 'SESSION_EXPIRED') {
    return new ApiError('AUTH_SESSION_EXPIRED');
  }
  
  if (error.code === 'ACCOUNT_LOCKED') {
    return new ApiError(
      'AUTH_ACCOUNT_LOCKED',
      403,
      undefined,
      'Your account has been locked. Please contact support'
    );
  }
  
  return new ApiError('SYS_SERVER_ERROR', 500, undefined, error.message);
}
```

#### 10. React Error Hooks

**File**: `src/lib/errors/hooks.ts`

```typescript
import { useMemo, useCallback } from 'react';
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { parseError, isValidationError } from './utils';
import { handleApiError } from './client';
import { ErrorResponse, ValidationErrorDetails } from './types';

export function useApiError<T = unknown>(
  error: unknown
): ErrorResponse & { details?: T } {
  return useMemo(() => parseError<T>(error), [error]);
}

export function useFieldError(
  fieldName: string,
  error: unknown
): string | string[] | undefined {
  const apiError = useApiError<ValidationErrorDetails>(error);
  
  if (!isValidationError(apiError)) {
    return undefined;
  }
  
  return apiError.details?.fields?.[fieldName];
}

export function useValidationErrors(
  error: unknown
): Record<string, string | string[]> | undefined {
  const apiError = useApiError<ValidationErrorDetails>(error);
  
  if (!isValidationError(apiError)) {
    return undefined;
  }
  
  return apiError.details?.fields;
}

export function useSafeMutation<TData, TVariables, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, unknown, TVariables, TContext> & {
    successMessage?: string | ((data: TData) => string);
    errorMessage?: string | ((error: ErrorResponse) => string);
    silent?: boolean;
  }
) {
  const handleError = useCallback(
    (error: unknown) => {
      if (!options?.silent) {
        const parsed = parseError(error);
        const message = 
          typeof options?.errorMessage === 'function'
            ? options.errorMessage(parsed)
            : options?.errorMessage;
        
        handleApiError(error, { fallbackMessage: message });
      }
      
      options?.onError?.(error, undefined as any, undefined);
    },
    [options]
  );
  
  const handleSuccess = useCallback(
    (data: TData, variables: TVariables, context: TContext | undefined) => {
      if (options?.successMessage) {
        const message = 
          typeof options.successMessage === 'function'
            ? options.successMessage(data)
            : options.successMessage;
        
        toast.success(message);
      }
      
      options?.onSuccess?.(data, variables, context);
    },
    [options]
  );
  
  return useMutation({
    ...options,
    mutationFn,
    onError: handleError,
    onSuccess: handleSuccess,
  });
}
```

#### 11. QueryClient Global Error Config

**File**: `src/lib/hooks/providers.tsx` (Update existing)

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { handleApiError } from "@/lib/errors/client";
import { parseError } from "@/lib/errors/utils";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Smart retry logic
      retry: (failureCount, error) => {
        const parsed = parseError(error);
        
        // Don't retry auth errors
        if (parsed.code.startsWith('AUTH_')) return false;
        
        // Don't retry validation errors
        if (parsed.code.startsWith('VAL_')) return false;
        
        // Don't retry business logic errors
        if (parsed.code.startsWith('BIZ_')) return false;
        
        // Check if error is retryable
        if (!parsed.retryable) return false;
        
        // Retry up to 3 times for retryable errors
        return failureCount < 3;
      },
      
      // Exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      staleTime: 1000 * 60, // 1 minute
    },
    
    mutations: {
      // Global error handler
      onError: (error) => {
        handleApiError(error);
      },
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Rest of providers */}
    </QueryClientProvider>
  );
}
```

#### 12. Error Recovery Actions

Already implemented in `handleErrorAction` function in `client.ts`. Extend as needed:

```typescript
// Additional actions
case 'resend-verification':
  window.location.href = '/auth/verify-email';
  break;
  
case 'request-access':
  window.location.href = '/request-access';
  break;
  
case 'go-back':
  window.history.back();
  break;
```

#### 13. Page-Level Error Components

**File**: `src/components/page/page-error.tsx`

```typescript
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ErrorResponse } from '@/lib/errors/types';
import { handleErrorAction } from '@/lib/errors/client';
import { FileQuestion, Lock, ServerCrash, WifiOff, AlertTriangle } from 'lucide-react';

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
      
      {error.statusCode && [404, 403, 500].includes(error.statusCode) && (
        <div className="text-6xl font-bold text-muted-foreground mb-4">
          {error.statusCode}
        </div>
      )}
      
      <h1 className="text-2xl font-bold mb-2">{getTitle()}</h1>
      
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        {error.message}
      </p>
      
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

#### 14. Loading State Management

**File**: `src/hooks/use-data-states.ts`

```typescript
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

export function useDataStates<T>(
  queryFn: () => Promise<T>,
  options: {
    onError?: (error: ErrorResponse) => void;
    onSuccess?: (data: T) => void;
    retryLimit?: number;
    retryDelay?: number;
    autoRetry?: boolean;
  } = {}
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
        }, retryDelay * Math.pow(2, retryCount));
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

#### 15. Form Error Summary

**File**: `src/components/form/form-error-summary.tsx`

```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useApiError, useValidationErrors, isValidationError } from '@/lib/errors/hooks';

export function FormErrorSummary({ error }: { error: unknown }) {
  const parsed = useApiError(error);
  const validationErrors = useValidationErrors(error);
  
  // Don't show if only field-level errors without summary
  if (isValidationError(parsed) && validationErrors) {
    const hasGeneralError = parsed.details?.summary;
    if (!hasGeneralError && Object.keys(validationErrors).length > 0) {
      return null; // Let field-level errors handle it
    }
  }
  
  // Don't show if no error
  if (!error) return null;
  
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {parsed.code === 'VAL_INVALID_FORMAT' ? 'Please check your input' : 'Error'}
      </AlertTitle>
      <AlertDescription>
        {parsed.message}
        
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
```

## Files to Refactor

### Priority 1: Server Functions (6 files)

1. **`src/features/todos/lib/todos.server.ts`**
   - Replace `throw new AppError()` with `throw new ApiError()`
   - Use error codes from registry
   - Transform Zod validation errors

2. **`src/features/todos/lib/todos-table.server.ts`**
   - Add error middleware wrapper
   - Handle pagination errors
   - Add filter validation

3. **`src/features/team/lib/team.server.ts`**
   - Standardize error messages
   - Add invitation-specific errors
   - Handle member role errors

4. **`src/features/organization/lib/members.server.ts`**
   - Add validation for member operations
   - Handle duplicate member errors
   - Add role change errors

5. **`src/features/organization/lib/onboarding.server.ts`**
   - Add state transition errors
   - Validate onboarding steps
   - Handle completion errors

6. **`src/features/billing/lib/billing.server.ts`**
   - Transform Stripe errors to our format
   - Add subscription state errors
   - Handle payment failures

### Priority 2: API Routes (4 files)

1. **`src/routes/api/avatars/upload.ts`**
   - Add file validation errors
   - Size limit errors
   - Format validation

2. **`src/routes/api/avatars/$.ts`**
   - Add not found errors
   - Permission checks
   - Stream errors

3. **`src/routes/api/stripe/webhook.ts`**
   - Webhook signature validation
   - Event processing errors
   - Idempotency handling

4. **`src/routes/api/health.ts`**
   - Service-specific health checks
   - Dependency errors
   - Structured response

### Priority 3: Components (10 files)

1. **`src/features/todos/components/todos-table-page.tsx`**
   - Replace `toast.error()` with `handleApiError()`
   - Add `DataTableError` component
   - Use `useSafeMutation` for actions

2. **`src/routes/_authenticated/team.tsx`**
   - Centralize error handling
   - Add form validation display
   - Use error hooks

3. **`src/routes/_authenticated/profile.tsx`**
   - Use `useSafeMutation`
   - Add avatar upload errors
   - Form validation

4. **`src/components/avatar-upload-dialog.tsx`**
   - File validation errors
   - Upload progress errors
   - Use form error display

5. **`src/features/auth/components/onboarding-form.tsx`**
   - Add `FormErrorSummary`
   - Step validation
   - Progress errors

6. **`src/features/organization/components/organization-switcher.tsx`**
   - Handle switching errors
   - Loading states
   - Permission errors

7. **`src/routes/invite.$invitationId.tsx`**
   - Simplify error flows
   - Invitation validation
   - Expiry handling

8. **`src/features/auth/components/magic-link-sign-in.tsx`**
   - Rate limiting errors
   - Email validation
   - Use `useSafeMutation`

9. **`src/features/auth/components/otp-sign-in.tsx`**
   - OTP validation
   - Expiry errors
   - Rate limiting

10. **`src/features/billing/components/billing-page.tsx`**
    - Stripe error transformation
    - Subscription errors
    - Portal errors

## Migration Strategy

### Week 1: Foundation
- **Day 1**: Create error system core (classes, types, utils)
- **Day 2**: Implement server middleware and wrappers
- **Day 3**: Set up client-side handlers and toast replacement
- **Day 4**: Create UI components (table error, form errors)
- **Day 5**: Test end-to-end flow with one feature

### Week 2: Implementation
- **Day 1-2**: Refactor all server functions
- **Day 3**: Update API routes
- **Day 4-5**: Refactor priority components
- **Day 6-7**: Complete remaining components

### Rollout Plan

1. **Feature Flag Control**
```typescript
const USE_NEW_ERROR_SYSTEM = process.env.NEXT_PUBLIC_NEW_ERRORS === 'true';

export function handleError(error: unknown) {
  if (USE_NEW_ERROR_SYSTEM) {
    return handleApiError(error);
  }
  // Fallback to old system
  toast.error(error.message || 'An error occurred');
}
```

2. **Gradual Migration**
   - Start with non-critical features
   - Monitor error rates
   - Gather user feedback
   - Full rollout after validation

3. **Backward Compatibility**
   - Keep old patterns working
   - Support both error formats
   - Gradual deprecation

## Testing Strategy

### Unit Tests
```typescript
describe('Error System', () => {
  it('should parse ApiError correctly', () => {
    const error = new ApiError('AUTH_INVALID_CREDENTIALS');
    const parsed = parseError(error);
    expect(parsed.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
  
  it('should handle validation errors', () => {
    const error = ApiError.validation({ email: 'Invalid email' });
    const parsed = parseError(error);
    expect(parsed.details.fields.email).toBe('Invalid email');
  });
});
```

### Integration Tests
- Test server function error handling
- Test API route error responses
- Test component error display
- Test recovery actions

### E2E Tests
- Test complete error flows
- Test retry mechanisms
- Test error recovery
- Test user interactions

## Success Metrics

1. **Technical Metrics**
   - ✅ 100% of server functions use ApiError
   - ✅ All toast.error() calls replaced
   - ✅ All forms show validation errors
   - ✅ Tables show error states
   - ✅ TypeScript coverage

2. **User Experience Metrics**
   - Reduced support tickets
   - Faster error resolution
   - Higher retry success rate
   - Better user feedback

3. **Developer Experience Metrics**
   - Faster debugging with request IDs
   - Consistent error patterns
   - Better test coverage
   - Reduced error-related bugs

## Risk Mitigation

1. **Breaking Changes**
   - Use feature flags
   - Keep compatibility layer
   - Gradual rollout

2. **Performance Impact**
   - Lazy load error components
   - Memoize error parsing
   - Optimize retry logic

3. **Team Adoption**
   - Documentation and examples
   - Code review checklist
   - Training sessions

## Maintenance & Documentation

### Developer Guidelines
1. Always use ApiError for server errors
2. Never show technical details to users
3. Provide recovery actions when possible
4. Test error scenarios
5. Use appropriate error codes

### Code Examples
```typescript
// Server-side
throw new ApiError('BIZ_LIMIT_EXCEEDED', 403, { limit: 10 }, 'Upgrade to create more items');

// Client-side
const mutation = useSafeMutation(createTodo, {
  successMessage: 'Todo created',
  errorMessage: (error) => error.code === 'BIZ_LIMIT_EXCEEDED' 
    ? 'Upgrade your plan' 
    : error.message
});

// Form validation
<FormField name="email" error={mutation.error}>
  <Input {...register('email')} />
</FormField>
<FormFieldError name="email" error={mutation.error} />
```

## Conclusion

This implementation plan provides a comprehensive, phased approach to implementing a robust error handling system. The system will:

1. **Improve User Experience** with clear, actionable error messages
2. **Enhance Developer Experience** with consistent patterns and debugging tools
3. **Increase Reliability** through proper error recovery and retry mechanisms
4. **Maintain Compatibility** during migration
5. **Scale Effectively** as the application grows

The implementation focuses on practical, immediate improvements while laying the foundation for future enhancements like i18n and advanced monitoring.