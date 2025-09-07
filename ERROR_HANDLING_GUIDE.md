# Comprehensive Error Handling System Guide

## Overview

This guide defines a complete error handling system for TanStack Start applications using TanStack Query and Better Auth. The system provides consistent error handling across the entire stack with excellent developer experience (DX) and user experience (UX), while being i18n-ready from day one.

## Table of Contents

1. [Core Principles](#core-principles)
2. [System Architecture](#system-architecture)
3. [Error Response Structure](#error-response-structure)
4. [Error Code System](#error-code-system)
5. [Server-Side Implementation](#server-side-implementation)
6. [Client-Side Implementation](#client-side-implementation)
7. [React Integration](#react-integration)
8. [Form Handling](#form-handling)
9. [Testing Utilities](#testing-utilities)
10. [Implementation Examples](#implementation-examples)
11. [Migration Guide](#migration-guide)
12. [Best Practices](#best-practices)
13. [Quick Reference](#quick-reference)

## Core Principles

1. **User-First Messages**: Technical errors never leak to users
2. **Actionable Feedback**: Every error suggests next steps when possible
3. **Type Safety**: Full TypeScript support throughout
4. **i18n Ready**: Structured for easy localization
5. **Monitoring Ready**: Built for observability and debugging
6. **Progressive Enhancement**: Simple cases stay simple, complex cases are supported

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Side                          │
├─────────────────────────────────────────────────────────────┤
│  Components → Hooks → Error Handler → Toast/UI              │
│                           ↓                                  │
│                    QueryClient Config                        │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP
┌─────────────────────────────────────────────────────────────┐
│                         Server Side                          │
├─────────────────────────────────────────────────────────────┤
│  Server Functions → Middleware → Error Transform → Response  │
│                           ↓                                  │
│                      ApiError Class                          │
└─────────────────────────────────────────────────────────────┘
```

## Error Response Structure

### Types Definition

```typescript
// src/lib/errors/types.ts

/**
 * Standard error response format used throughout the application
 */
export interface ErrorResponse {
  /**
   * Machine-readable error code (e.g., "AUTH_INVALID_CREDENTIALS")
   * Used for programmatic error handling and i18n
   */
  code: string;
  
  /**
   * Human-readable message for display to users
   * Falls back to default message if not provided
   */
  message: string;
  
  /**
   * HTTP status code for API responses
   */
  statusCode?: number;
  
  /**
   * Additional error context (validation errors, metadata)
   */
  details?: any;
  
  /**
   * ISO timestamp of when the error occurred
   */
  timestamp: string;
  
  /**
   * Unique request ID for tracking/support
   */
  requestId?: string;
  
  /**
   * Whether the operation can be retried
   */
  retryable: boolean;
  
  /**
   * Suggested actions for error recovery
   */
  actions?: ErrorAction[];
}

/**
 * Suggested action for error recovery
 */
export interface ErrorAction {
  /**
   * Display label for the action (e.g., "Try Again", "Contact Support")
   */
  label: string;
  
  /**
   * Action identifier for handling (e.g., "retry", "support", "login")
   */
  action: string;
  
  /**
   * Optional additional data for the action
   */
  data?: any;
}

/**
 * Validation error details structure
 */
export interface ValidationErrorDetails {
  fields: Record<string, string | string[]>;
  summary?: string;
}
```

## Error Code System

### Error Code Definitions

```typescript
// src/lib/errors/codes.ts

/**
 * Centralized error code definitions
 * Format: CATEGORY_SPECIFIC_ERROR
 * 
 * Categories:
 * - AUTH: Authentication/authorization errors
 * - VAL: Validation errors
 * - BIZ: Business logic errors
 * - SYS: System/infrastructure errors
 * - NET: Network-related errors
 */
export const ErrorCodes = {
  // Authentication & Authorization (AUTH_*)
  AUTH_INVALID_CREDENTIALS: {
    messageKey: 'errors.auth.invalidCredentials',
    defaultMessage: 'Invalid email or password',
    statusCode: 401,
    retryable: true,
  },
  AUTH_SESSION_EXPIRED: {
    messageKey: 'errors.auth.sessionExpired',
    defaultMessage: 'Your session has expired. Please sign in again',
    statusCode: 401,
    retryable: false,
    actions: [{ label: 'Sign In', action: 'login' }],
  },
  AUTH_INSUFFICIENT_PERMISSIONS: {
    messageKey: 'errors.auth.insufficientPermissions',
    defaultMessage: "You don't have permission to perform this action",
    statusCode: 403,
    retryable: false,
  },
  AUTH_ACCOUNT_LOCKED: {
    messageKey: 'errors.auth.accountLocked',
    defaultMessage: 'Your account has been locked. Please contact support',
    statusCode: 403,
    retryable: false,
    actions: [{ label: 'Contact Support', action: 'support' }],
  },
  
  // Validation Errors (VAL_*)
  VAL_REQUIRED_FIELD: {
    messageKey: 'errors.validation.required',
    defaultMessage: 'This field is required',
    statusCode: 400,
    retryable: true,
  },
  VAL_INVALID_FORMAT: {
    messageKey: 'errors.validation.invalidFormat',
    defaultMessage: 'Please enter a valid format',
    statusCode: 400,
    retryable: true,
  },
  VAL_INVALID_EMAIL: {
    messageKey: 'errors.validation.invalidEmail',
    defaultMessage: 'Please enter a valid email address',
    statusCode: 400,
    retryable: true,
  },
  VAL_PASSWORD_TOO_WEAK: {
    messageKey: 'errors.validation.passwordWeak',
    defaultMessage: 'Password must be at least 8 characters with a mix of letters and numbers',
    statusCode: 400,
    retryable: true,
  },
  
  // Business Logic Errors (BIZ_*)
  BIZ_LIMIT_EXCEEDED: {
    messageKey: 'errors.business.limitExceeded',
    defaultMessage: "You've reached your plan limit",
    statusCode: 403,
    retryable: false,
    actions: [{ label: 'Upgrade Plan', action: 'upgrade' }],
  },
  BIZ_DUPLICATE_ENTRY: {
    messageKey: 'errors.business.duplicate',
    defaultMessage: 'This item already exists',
    statusCode: 409,
    retryable: false,
  },
  BIZ_NOT_FOUND: {
    messageKey: 'errors.business.notFound',
    defaultMessage: 'The requested item was not found',
    statusCode: 404,
    retryable: false,
  },
  BIZ_INVALID_STATE: {
    messageKey: 'errors.business.invalidState',
    defaultMessage: 'This action cannot be performed in the current state',
    statusCode: 400,
    retryable: false,
  },
  
  // System Errors (SYS_*)
  SYS_SERVER_ERROR: {
    messageKey: 'errors.system.serverError',
    defaultMessage: "Something went wrong. We're working on it",
    statusCode: 500,
    retryable: true,
    actions: [{ label: 'Try Again', action: 'retry' }],
  },
  SYS_MAINTENANCE: {
    messageKey: 'errors.system.maintenance',
    defaultMessage: "We're performing maintenance. Please try again later",
    statusCode: 503,
    retryable: false,
  },
  SYS_RATE_LIMIT: {
    messageKey: 'errors.system.rateLimit',
    defaultMessage: "You're making too many requests. Please slow down",
    statusCode: 429,
    retryable: true,
  },
  
  // Network Errors (NET_*)
  NET_CONNECTION_ERROR: {
    messageKey: 'errors.network.connection',
    defaultMessage: 'Connection problem. Please check your internet and try again',
    statusCode: 0,
    retryable: true,
    actions: [{ label: 'Retry', action: 'retry' }],
  },
  NET_TIMEOUT: {
    messageKey: 'errors.network.timeout',
    defaultMessage: 'The request took too long. Please try again',
    statusCode: 408,
    retryable: true,
    actions: [{ label: 'Retry', action: 'retry' }],
  },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
```

## Server-Side Implementation

### ApiError Class

```typescript
// src/lib/errors/api-error.ts

import { ErrorCodes, ErrorCode } from './codes';
import type { ErrorResponse, ErrorAction, ValidationErrorDetails } from './types';

/**
 * Custom error class for API errors
 * Provides consistent error structure and serialization
 */
export class ApiError extends Error {
  public code: ErrorCode;
  public statusCode: number;
  public details?: any;
  public userMessage?: string;
  public actions?: ErrorAction[];

  constructor(
    code: ErrorCode,
    details?: any,
    userMessage?: string,
    actions?: ErrorAction[]
  ) {
    const errorDef = ErrorCodes[code];
    super(userMessage || errorDef.defaultMessage);
    
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = errorDef.statusCode || 500;
    this.details = details;
    this.userMessage = userMessage;
    this.actions = actions || errorDef.actions;
  }

  /**
   * Convert error to response format
   */
  toResponse(requestId?: string): ErrorResponse {
    const errorDef = ErrorCodes[this.code];
    
    return {
      code: this.code,
      message: this.userMessage || errorDef.defaultMessage,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: new Date().toISOString(),
      requestId,
      retryable: errorDef.retryable ?? false,
      actions: this.actions || [],
    };
  }

  /**
   * Create validation error with field details
   */
  static validation(
    fields: Record<string, string | string[]>,
    summary?: string
  ): ApiError {
    return new ApiError(
      'VAL_INVALID_FORMAT',
      { fields, summary } as ValidationErrorDetails,
      summary || 'Please check the highlighted fields'
    );
  }

  /**
   * Create not found error
   */
  static notFound(resource: string): ApiError {
    return new ApiError(
      'BIZ_NOT_FOUND',
      { resource },
      `${resource} not found`
    );
  }

  /**
   * Create permission error
   */
  static permission(action?: string): ApiError {
    return new ApiError(
      'AUTH_INSUFFICIENT_PERMISSIONS',
      { action },
      action ? `You don't have permission to ${action}` : undefined
    );
  }
}
```

### Server Middleware

```typescript
// src/lib/errors/middleware.ts

import { createMiddleware } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';
import { ApiError } from './api-error';
import { parseError } from './utils';
import { nanoid } from 'nanoid';

/**
 * Error handling middleware for TanStack Start server functions
 * Catches and transforms all errors to consistent format
 */
export const errorMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    const request = getWebRequest();
    const requestId = nanoid();
    
    try {
      // Add request ID to context for tracking
      return await next({
        context: { requestId }
      });
    } catch (error) {
      // Log error for monitoring
      console.error(`[${requestId}] Error:`, error);
      
      // Transform to ApiError if needed
      if (error instanceof ApiError) {
        // Already in correct format
        throw error.toResponse(requestId);
      }
      
      // Parse unknown errors
      const parsed = parseError(error);
      
      // Log unexpected errors for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('Unhandled error details:', {
          requestId,
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          } : error,
        });
      }
      
      // Return consistent error response
      throw {
        ...parsed,
        requestId,
        timestamp: new Date().toISOString(),
      };
    }
  });

/**
 * Wrapper for creating server functions with error handling
 */
export function createServerFn<TInput = void, TOutput = any>(
  options: {
    method?: 'GET' | 'POST';
    middleware?: any[];
    validator?: (input: unknown) => TInput;
  } = {}
) {
  const middlewares = [
    ...(options.middleware || []),
    errorMiddleware,
  ];
  
  return createServerFn({
    method: options.method || 'POST',
  })
    .middleware(middlewares)
    .validator(options.validator || ((x) => x as TInput));
}
```

## Client-Side Implementation

### Query Client Configuration

```typescript
// src/lib/errors/client.ts

import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { parseError, isNetworkError, isValidationError } from './utils';
import type { ErrorResponse } from './types';

/**
 * Configure QueryClient with global error handling
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Smart retry logic based on error type
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
        
        // Retry delay with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Stale time
        staleTime: 1000 * 60, // 1 minute
      },
      
      mutations: {
        // Global error handler for mutations
        onError: (error) => {
          handleApiError(error);
        },
      },
    },
  });
}

/**
 * Global error handler
 */
export function handleApiError(
  error: unknown,
  options?: {
    silent?: boolean;
    fallbackMessage?: string;
  }
) {
  const parsed = parseError(error);
  
  // Don't show toast for validation errors (handle inline)
  if (isValidationError(parsed) && !options?.fallbackMessage) {
    return parsed;
  }
  
  // Don't show toast if silent
  if (options?.silent) {
    return parsed;
  }
  
  // Show error toast with actions
  showErrorToast(parsed, options?.fallbackMessage);
  
  // Track error for monitoring
  if (typeof window !== 'undefined' && window.trackError) {
    window.trackError(parsed);
  }
  
  return parsed;
}

/**
 * Show error toast with action buttons
 */
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
        onClick: () => handleErrorAction(primaryAction),
      },
      duration: 5000,
    });
  } else {
    toast.error(message, {
      duration: 4000,
    });
  }
}

/**
 * Handle error action clicks
 */
export function handleErrorAction(action: ErrorAction) {
  switch (action.action) {
    case 'retry':
      // Trigger retry logic
      window.location.reload();
      break;
      
    case 'login':
      // Redirect to login
      window.location.href = '/auth/signin';
      break;
      
    case 'upgrade':
      // Redirect to billing
      window.location.href = '/billing';
      break;
      
    case 'support':
      // Open support dialog or redirect
      window.location.href = '/support';
      break;
      
    default:
      // Custom action handling
      if (action.data?.href) {
        window.location.href = action.data.href;
      }
  }
}
```

### Utility Functions

```typescript
// src/lib/errors/utils.ts

import type { ErrorResponse } from './types';
import { ErrorCodes } from './codes';

/**
 * Parse any error into ErrorResponse format
 */
export function parseError<T = unknown>(
  error: unknown
): ErrorResponse & { details?: T } {
  // Already in correct format
  if (isErrorResponse(error)) {
    return error as ErrorResponse & { details?: T };
  }
  
  // API Error from server
  if (isApiErrorResponse(error)) {
    return error;
  }
  
  // Network error
  if (isNetworkError(error)) {
    return {
      code: 'NET_CONNECTION_ERROR',
      message: ErrorCodes.NET_CONNECTION_ERROR.defaultMessage,
      statusCode: 0,
      timestamp: new Date().toISOString(),
      retryable: true,
      actions: ErrorCodes.NET_CONNECTION_ERROR.actions || [],
    };
  }
  
  // Standard Error object
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('Network')) {
      return parseError({ code: 'NET_CONNECTION_ERROR' });
    }
    
    if (error.message.includes('timeout')) {
      return parseError({ code: 'NET_TIMEOUT' });
    }
    
    return {
      code: 'SYS_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' 
        ? error.message 
        : ErrorCodes.SYS_SERVER_ERROR.defaultMessage,
      statusCode: 500,
      timestamp: new Date().toISOString(),
      retryable: true,
      actions: ErrorCodes.SYS_SERVER_ERROR.actions || [],
    };
  }
  
  // Unknown error
  return {
    code: 'SYS_SERVER_ERROR',
    message: ErrorCodes.SYS_SERVER_ERROR.defaultMessage,
    statusCode: 500,
    timestamp: new Date().toISOString(),
    retryable: true,
    actions: ErrorCodes.SYS_SERVER_ERROR.actions || [],
  };
}

/**
 * Type guard for ErrorResponse
 */
export function isErrorResponse(error: unknown): error is ErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'timestamp' in error
  );
}

/**
 * Type guard for API error response
 */
export function isApiErrorResponse(error: unknown): error is ErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string'
  );
}

/**
 * Check if error is network-related
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  
  // Check for fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // Check for network error codes
  if (isErrorResponse(error)) {
    return error.code.startsWith('NET_');
  }
  
  // Check for zero status code (no connection)
  if (typeof error === 'object' && 'statusCode' in error) {
    return (error as any).statusCode === 0;
  }
  
  return false;
}

/**
 * Check if error is validation-related
 */
export function isValidationError(error: ErrorResponse): boolean {
  return error.code.startsWith('VAL_');
}

/**
 * Check if error is auth-related
 */
export function isAuthError(error: ErrorResponse): boolean {
  return error.code.startsWith('AUTH_');
}

/**
 * Try-catch wrapper with typed errors
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<[T, null] | [null, ErrorResponse]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    return [null, parseError(error)];
  }
}

/**
 * Create a request ID for tracking
 */
export function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

## React Integration

### Custom Hooks

```typescript
// src/lib/errors/hooks.ts

import { useMemo, useCallback } from 'react';
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { parseError, isValidationError } from './utils';
import { handleApiError } from './client';
import type { ErrorResponse, ValidationErrorDetails } from './types';
import { ErrorCodes } from './codes';

/**
 * Parse and type error response
 */
export function useApiError<T = unknown>(
  error: unknown
): ErrorResponse & { details?: T } {
  return useMemo(() => parseError<T>(error), [error]);
}

/**
 * Get localized error message
 */
export function useLocalizedError(error: unknown) {
  const { t } = useTranslation();
  const apiError = useApiError(error);
  
  const localizedMessage = useMemo(() => {
    const errorDef = ErrorCodes[apiError.code as keyof typeof ErrorCodes];
    
    if (errorDef?.messageKey) {
      return t(errorDef.messageKey, {
        defaultValue: apiError.message,
      });
    }
    
    return apiError.message;
  }, [apiError, t]);
  
  return {
    ...apiError,
    message: localizedMessage,
  };
}

/**
 * Enhanced mutation hook with built-in error handling
 */
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

/**
 * Extract field-specific validation errors
 */
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

/**
 * Get all validation errors
 */
export function useValidationErrors(
  error: unknown
): Record<string, string | string[]> | undefined {
  const apiError = useApiError<ValidationErrorDetails>(error);
  
  if (!isValidationError(apiError)) {
    return undefined;
  }
  
  return apiError.details?.fields;
}
```

### Error Boundary Component

```typescript
// src/components/error-boundary.tsx

import { Component, ReactNode } from 'react';
import { toast } from 'sonner';
import { parseError } from '@/lib/errors/utils';
import { handleApiError } from '@/lib/errors/client';
import type { ErrorResponse } from '@/lib/errors/types';

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
    
    // Log error details in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught:');
      console.error('Error:', error);
      console.error('Parsed:', parsed);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
    
    // Handle error
    handleApiError(parsed);
    
    // Call custom error handler
    this.props.onError?.(parsed);
    
    // Track error for monitoring
    if (typeof window !== 'undefined' && window.trackError) {
      window.trackError({
        ...parsed,
        details: {
          ...parsed.details,
          componentStack: errorInfo.componentStack,
        },
      });
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-destructive mb-4">
              Something went wrong
            </h2>
            <p className="text-muted-foreground mb-6">
              {this.state.error.message}
            </p>
            
            {/* Show error code in development */}
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-muted-foreground mb-4 font-mono">
                Error Code: {this.state.error.code}
              </p>
            )}
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.reset}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Try Again
              </button>
              
              {this.state.error.actions?.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    import('@/lib/errors/client').then(({ handleErrorAction }) => {
                      handleErrorAction(action);
                    });
                  }}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Form Handling

### Form Field Error Component

```typescript
// src/components/form-field-error.tsx

import { useFieldError } from '@/lib/errors/hooks';

interface FormFieldErrorProps {
  name: string;
  error: unknown;
}

export function FormFieldError({ name, error }: FormFieldErrorProps) {
  const fieldError = useFieldError(name, error);
  
  if (!fieldError) return null;
  
  const errors = Array.isArray(fieldError) ? fieldError : [fieldError];
  
  return (
    <div className="mt-1">
      {errors.map((err, index) => (
        <p key={index} className="text-sm text-destructive">
          {err}
        </p>
      ))}
    </div>
  );
}
```

## Testing Utilities

```typescript
// src/lib/errors/testing.ts

import { ApiError } from './api-error';
import type { ErrorResponse } from './types';
import { parseError } from './utils';

/**
 * Mock error generators for testing
 */
export const mockErrors = {
  // Authentication errors
  invalidCredentials: () => 
    new ApiError('AUTH_INVALID_CREDENTIALS'),
  
  sessionExpired: () => 
    new ApiError('AUTH_SESSION_EXPIRED'),
  
  insufficientPermissions: (action?: string) => 
    ApiError.permission(action),
  
  // Validation errors
  validation: (fields: Record<string, string | string[]>) => 
    ApiError.validation(fields),
  
  requiredField: (fieldName: string) => 
    ApiError.validation({ [fieldName]: 'This field is required' }),
  
  // Business logic errors
  notFound: (resource: string) => 
    ApiError.notFound(resource),
  
  duplicate: () => 
    new ApiError('BIZ_DUPLICATE_ENTRY'),
  
  limitExceeded: () => 
    new ApiError('BIZ_LIMIT_EXCEEDED'),
  
  // System errors
  serverError: () => 
    new ApiError('SYS_SERVER_ERROR'),
  
  networkError: () => 
    new ApiError('NET_CONNECTION_ERROR'),
  
  timeout: () => 
    new ApiError('NET_TIMEOUT'),
};

/**
 * Test helper to assert error codes
 */
export function expectErrorCode(
  error: unknown,
  expectedCode: string
): void {
  const parsed = parseError(error);
  expect(parsed.code).toBe(expectedCode);
}

/**
 * Test helper to assert error has specific field error
 */
export function expectFieldError(
  error: unknown,
  fieldName: string,
  expectedMessage?: string
): void {
  const parsed = parseError(error);
  expect(parsed.code).toContain('VAL_');
  expect(parsed.details?.fields?.[fieldName]).toBeDefined();
  
  if (expectedMessage) {
    const fieldError = parsed.details.fields[fieldName];
    const message = Array.isArray(fieldError) ? fieldError[0] : fieldError;
    expect(message).toBe(expectedMessage);
  }
}

/**
 * Mock fetch with error response
 */
export function mockFetchError(error: ApiError): void {
  global.fetch = jest.fn().mockRejectedValue(error.toResponse());
}

/**
 * Mock successful fetch
 */
export function mockFetchSuccess(data: any): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}
```

## Implementation Examples

### Example 1: Server Function with Error Handling

```typescript
// src/features/todos/lib/todos.server.ts

import { z } from 'zod';
import { createServerFn } from '@/lib/errors/middleware';
import { ApiError } from '@/lib/errors/api-error';
import { authMiddleware } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
});

export const createTodo = createServerFn({
  middleware: [authMiddleware],
  validator: (data) => {
    try {
      return createTodoSchema.parse(data);
    } catch (error) {
      // Transform Zod errors to our format
      if (error instanceof z.ZodError) {
        const fields: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!fields[path]) fields[path] = [];
          fields[path].push(err.message);
        });
        throw ApiError.validation(fields);
      }
      throw error;
    }
  },
})
  .handler(async ({ data, context }) => {
    // Check permissions
    if (!context.user) {
      throw new ApiError('AUTH_SESSION_EXPIRED');
    }
    
    if (!context.user.canCreateTodos) {
      throw ApiError.permission('create todos');
    }
    
    // Check limits
    const todoCount = await db.todos.count({
      where: { userId: context.user.id },
    });
    
    if (todoCount >= context.user.todoLimit) {
      throw new ApiError(
        'BIZ_LIMIT_EXCEEDED',
        { limit: context.user.todoLimit, current: todoCount },
        `You've reached your limit of ${context.user.todoLimit} todos`
      );
    }
    
    // Create todo
    try {
      const todo = await db.todos.create({
        data: {
          ...data,
          userId: context.user.id,
        },
      });
      
      return todo;
    } catch (error) {
      // Handle database errors
      if (error.code === 'P2002') {
        throw new ApiError('BIZ_DUPLICATE_ENTRY');
      }
      
      // Re-throw unknown errors (will be caught by middleware)
      throw error;
    }
  });
```

### Example 2: React Component with Error Handling

```typescript
// src/features/todos/components/create-todo-form.tsx

import { useState } from 'react';
import { useSafeMutation } from '@/lib/errors/hooks';
import { createTodo } from '../lib/todos.server';
import { FormFieldError } from '@/components/form-field-error';
import { useValidationErrors } from '@/lib/errors/hooks';

export function CreateTodoForm() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
  });
  
  const mutation = useSafeMutation(
    async () => createTodo({ data: formData }),
    {
      successMessage: 'Todo created successfully',
      errorMessage: (error) => {
        // Custom messages for specific errors
        if (error.code === 'BIZ_LIMIT_EXCEEDED') {
          return 'Upgrade your plan to create more todos';
        }
        return error.message;
      },
      onSuccess: () => {
        // Reset form
        setFormData({
          title: '',
          description: '',
          priority: 'medium',
        });
      },
    }
  );
  
  const validationErrors = useValidationErrors(mutation.error);
  
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className={validationErrors?.title ? 'border-destructive' : ''}
        />
        <FormFieldError name="title" error={mutation.error} />
      </div>
      
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
        <FormFieldError name="description" error={mutation.error} />
      </div>
      
      <div>
        <label htmlFor="priority">Priority</label>
        <select
          id="priority"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <FormFieldError name="priority" error={mutation.error} />
      </div>
      
      {/* Show general error if not field-specific */}
      {mutation.error && !validationErrors && (
        <div className="p-4 bg-destructive/10 text-destructive rounded">
          {mutation.error.message}
        </div>
      )}
      
      <button
        type="submit"
        disabled={mutation.isPending}
        className="px-4 py-2 bg-primary text-primary-foreground rounded"
      >
        {mutation.isPending ? 'Creating...' : 'Create Todo'}
      </button>
    </form>
  );
}
```

### Example 3: Better Auth Integration

```typescript
// src/lib/auth/server-functions.ts

import { createServerFn } from '@/lib/errors/middleware';
import { ApiError } from '@/lib/errors/api-error';
import { auth } from './auth';

export const signIn = createServerFn({
  validator: (data: { email: string; password: string }) => data,
})
  .handler(async ({ data }) => {
    try {
      const result = await auth.signIn.email({
        email: data.email,
        password: data.password,
      });
      
      return result;
    } catch (error) {
      // Transform Better Auth errors
      if (error.code === 'INVALID_CREDENTIALS') {
        throw new ApiError('AUTH_INVALID_CREDENTIALS');
      }
      
      if (error.code === 'ACCOUNT_LOCKED') {
        throw new ApiError('AUTH_ACCOUNT_LOCKED');
      }
      
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        throw new ApiError(
          'AUTH_INVALID_CREDENTIALS',
          undefined,
          'Please verify your email before signing in',
          [{ label: 'Resend Verification', action: 'resend-verification' }]
        );
      }
      
      throw error;
    }
  });
```

## Migration Guide

### Step 1: Install Dependencies

```bash
npm install sonner react-i18next nanoid
```

### Step 2: Set Up Error System

1. Create directory structure:
```bash
mkdir -p src/lib/errors
```

2. Create all error system files:
   - `src/lib/errors/types.ts`
   - `src/lib/errors/codes.ts`
   - `src/lib/errors/api-error.ts`
   - `src/lib/errors/middleware.ts`
   - `src/lib/errors/client.ts`
   - `src/lib/errors/utils.ts`
   - `src/lib/errors/hooks.ts`
   - `src/lib/errors/testing.ts`

3. Create an index file for easy imports:

```typescript
// src/lib/errors/index.ts

export * from './types';
export * from './codes';
export * from './api-error';
export * from './middleware';
export * from './client';
export * from './utils';
export * from './hooks';
export { mockErrors } from './testing';
```

### Step 3: Update Provider Configuration

```typescript
// src/lib/hooks/providers.tsx

import { createQueryClient } from '@/lib/errors/client';

const queryClient = createQueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Rest of your providers */}
    </QueryClientProvider>
  );
}
```

### Step 4: Update Existing Server Functions

Before:
```typescript
import { createServerFn } from '@tanstack/react-start';

export const myFunction = createServerFn({ method: 'POST' })
  .handler(async () => {
    throw new Error('Something went wrong');
  });
```

After:
```typescript
import { createServerFn } from '@/lib/errors/middleware';
import { ApiError } from '@/lib/errors';

export const myFunction = createServerFn()
  .handler(async () => {
    throw new ApiError('SYS_SERVER_ERROR');
  });
```

### Step 5: Update Component Error Handling

Before:
```typescript
try {
  await someAction();
} catch (error) {
  toast.error(error.message || 'Failed to perform action');
}
```

After:
```typescript
import { useSafeMutation } from '@/lib/errors/hooks';

const mutation = useSafeMutation(someAction, {
  successMessage: 'Action completed',
});
```

### Step 6: Add Error Boundary

```typescript
// src/app.tsx

import { ErrorBoundary } from '@/components/error-boundary';

export function App() {
  return (
    <ErrorBoundary>
      {/* Your app content */}
    </ErrorBoundary>
  );
}
```

## Best Practices

### 1. Always Use Error Codes
```typescript
// ❌ Bad
throw new Error('Invalid email');

// ✅ Good
throw new ApiError('VAL_INVALID_EMAIL');
```

### 2. Provide Context in Details
```typescript
// ❌ Bad
throw new ApiError('BIZ_LIMIT_EXCEEDED');

// ✅ Good
throw new ApiError(
  'BIZ_LIMIT_EXCEEDED',
  { limit: 10, current: 10, resource: 'todos' }
);
```

### 3. Use Static Methods for Common Errors
```typescript
// ❌ Bad
throw new ApiError('BIZ_NOT_FOUND', { resource: 'Todo' }, 'Todo not found');

// ✅ Good
throw ApiError.notFound('Todo');
```

### 4. Transform External Errors
```typescript
// ❌ Bad
catch (error) {
  throw error; // Leaks implementation details
}

// ✅ Good
catch (error) {
  if (error.code === 'P2002') {
    throw new ApiError('BIZ_DUPLICATE_ENTRY');
  }
  throw error; // Unknown errors handled by middleware
}
```

### 5. Use Type-Safe Hooks
```typescript
// ❌ Bad
const error = mutation.error as any;
if (error?.details?.fields?.email) {
  // Handle email error
}

// ✅ Good
const emailError = useFieldError('email', mutation.error);
if (emailError) {
  // Handle email error
}
```

### 6. Provide Actionable Messages
```typescript
// ❌ Bad
throw new ApiError('AUTH_SESSION_EXPIRED');

// ✅ Good
throw new ApiError(
  'AUTH_SESSION_EXPIRED',
  undefined,
  undefined,
  [{ label: 'Sign In', action: 'login' }]
);
```

### 7. Test Error Scenarios
```typescript
import { mockErrors, expectErrorCode } from '@/lib/errors/testing';

it('should handle invalid credentials', async () => {
  mockFetchError(mockErrors.invalidCredentials());
  
  const result = await signIn({ email: 'test@test.com', password: 'wrong' });
  
  expectErrorCode(result.error, 'AUTH_INVALID_CREDENTIALS');
});
```

## Quick Reference

### Common Error Codes

| Code | Description | Status | Retryable |
|------|-------------|--------|-----------|
| `AUTH_INVALID_CREDENTIALS` | Wrong email/password | 401 | Yes |
| `AUTH_SESSION_EXPIRED` | Session timeout | 401 | No |
| `AUTH_INSUFFICIENT_PERMISSIONS` | No permission | 403 | No |
| `VAL_REQUIRED_FIELD` | Missing required field | 400 | Yes |
| `VAL_INVALID_FORMAT` | Invalid format | 400 | Yes |
| `BIZ_NOT_FOUND` | Resource not found | 404 | No |
| `BIZ_DUPLICATE_ENTRY` | Already exists | 409 | No |
| `BIZ_LIMIT_EXCEEDED` | Limit reached | 403 | No |
| `SYS_SERVER_ERROR` | Server error | 500 | Yes |
| `NET_CONNECTION_ERROR` | Network issue | 0 | Yes |

### Quick Usage Examples

#### Throwing Errors (Server)
```typescript
// Validation error
throw ApiError.validation({ email: 'Invalid email format' });

// Not found
throw ApiError.notFound('User');

// Permission denied
throw ApiError.permission('delete posts');

// Custom error
throw new ApiError('BIZ_CUSTOM_ERROR', { data }, 'User message');
```

#### Handling Errors (Client)
```typescript
// In mutations
const mutation = useSafeMutation(myServerFunction, {
  successMessage: 'Success!',
  errorMessage: 'Failed to complete action'
});

// Field errors
const emailError = useFieldError('email', mutation.error);

// All validation errors
const errors = useValidationErrors(mutation.error);

// Parse any error
const error = useApiError(someError);
```

#### Testing Errors
```typescript
// Mock errors
mockFetchError(mockErrors.notFound('User'));

// Assert error codes
expectErrorCode(error, 'BIZ_NOT_FOUND');

// Assert field errors
expectFieldError(error, 'email', 'Invalid email');
```

## Monitoring & Debugging

### Development Mode
- Full error details in console
- Stack traces preserved
- Error codes shown in UI
- Request IDs for tracking

### Production Mode
- User-friendly messages only
- Technical details logged server-side
- Error tracking ready (Sentry, etc.)
- Request IDs for support

### Adding Error Tracking
```typescript
// src/lib/errors/tracking.ts

declare global {
  interface Window {
    trackError: (error: ErrorResponse) => void;
  }
}

// Initialize in app
window.trackError = (error) => {
  // Send to Sentry, LogRocket, etc.
  console.error('Track error:', error);
};
```

## Future Enhancements

1. **Error Analytics Dashboard**: Admin panel for error monitoring
2. **Smart Retry Logic**: Circuit breakers and exponential backoff
3. **Error Recovery Flows**: Guided recovery for complex errors
4. **A/B Testing**: Test different error messages
5. **Contextual Help**: Help documentation links in errors
6. **User Reporting**: Allow users to report errors with context
7. **Offline Support**: Handle offline scenarios gracefully
8. **Rate Limiting UI**: Visual feedback for rate limits

---

This error handling system provides a robust, type-safe, and user-friendly approach to error management that scales from simple to complex applications while maintaining consistency and preparing for future internationalization.