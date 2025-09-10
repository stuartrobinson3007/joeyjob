import { ReactNode } from 'react';

export interface FormEditorError {
  id: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  context?: string;
  timestamp: Date;
  retryable?: boolean;
  details?: Record<string, any>;
}

export interface ErrorHandlerOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  retryDelayMs?: number;
  /** Whether to use exponential backoff for retries */
  useExponentialBackoff?: boolean;
  /** Enable console logging */
  enableLogging?: boolean;
  /** Custom error reporter function */
  onError?: (error: FormEditorError) => void;
  /** Show toast notifications */
  showToasts?: boolean;
}

export interface RetryableOperation<T> {
  operation: () => Promise<T>;
  errorMessage?: string;
  context?: string;
  retryable?: boolean;
}

export class FormEditorErrorHandler {
  private errors: FormEditorError[] = [];
  private options: Required<ErrorHandlerOptions>;
  private errorListeners: Set<(errors: FormEditorError[]) => void> = new Set();

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      maxRetries: 3,
      retryDelayMs: 1000,
      useExponentialBackoff: true,
      enableLogging: true,
      onError: () => {},
      showToasts: false,
      ...options
    };
  }

  /**
   * Create an error instance
   */
  createError(
    code: string,
    message: string,
    options: {
      severity?: 'error' | 'warning' | 'info';
      context?: string;
      retryable?: boolean;
      details?: Record<string, any>;
    } = {}
  ): FormEditorError {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      code,
      message,
      severity: options.severity || 'error',
      context: options.context,
      timestamp: new Date(),
      retryable: options.retryable || false,
      details: options.details
    };
  }

  /**
   * Add an error to the collection
   */
  addError(error: FormEditorError): void {
    this.errors.push(error);
    this.notifyListeners();

    if (this.options.enableLogging) {
      console.error(`[FormEditor] ${error.severity.toUpperCase()}: ${error.message}`, {
        code: error.code,
        context: error.context,
        details: error.details
      });
    }

    this.options.onError(error);
  }

  /**
   * Handle an error (create and add)
   */
  handleError(
    code: string,
    message: string,
    options: {
      severity?: 'error' | 'warning' | 'info';
      context?: string;
      retryable?: boolean;
      details?: Record<string, any>;
    } = {}
  ): FormEditorError {
    const error = this.createError(code, message, options);
    this.addError(error);
    return error;
  }

  /**
   * Handle JavaScript errors and convert them to FormEditorErrors
   */
  handleJSError(
    jsError: Error,
    context?: string,
    additionalDetails?: Record<string, any>
  ): FormEditorError {
    const error = this.createError(
      'JS_ERROR',
      jsError.message,
      {
        severity: 'error',
        context,
        retryable: false,
        details: {
          name: jsError.name,
          stack: jsError.stack,
          ...additionalDetails
        }
      }
    );
    this.addError(error);
    return error;
  }

  /**
   * Execute a retryable operation with error handling
   */
  async executeWithRetry<T>(operation: RetryableOperation<T>): Promise<T> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= this.options.maxRetries) {
      try {
        if (this.options.enableLogging && attempt > 0) {
          console.log(`[FormEditor] Retry attempt ${attempt}/${this.options.maxRetries} for ${operation.context || 'operation'}`);
        }

        return await operation.operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt > this.options.maxRetries) {
          break;
        }

        // Only retry if operation is marked as retryable
        if (operation.retryable === false) {
          break;
        }

        // Calculate delay with optional exponential backoff
        const delay = this.options.useExponentialBackoff
          ? this.options.retryDelayMs * Math.pow(2, attempt - 1)
          : this.options.retryDelayMs;

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed, handle the error
    const formEditorError = this.handleError(
      'OPERATION_FAILED',
      operation.errorMessage || lastError?.message || 'Operation failed after retries',
      {
        severity: 'error',
        context: operation.context,
        retryable: operation.retryable !== false,
        details: {
          attempts: attempt,
          originalError: lastError?.message,
          stack: lastError?.stack
        }
      }
    );

    throw formEditorError;
  }

  /**
   * Clear a specific error by ID
   */
  clearError(errorId: string): void {
    this.errors = this.errors.filter(error => error.id !== errorId);
    this.notifyListeners();
  }

  /**
   * Clear errors by code
   */
  clearErrorsByCode(code: string): void {
    this.errors = this.errors.filter(error => error.code !== code);
    this.notifyListeners();
  }

  /**
   * Clear errors by context
   */
  clearErrorsByContext(context: string): void {
    this.errors = this.errors.filter(error => error.context !== context);
    this.notifyListeners();
  }

  /**
   * Clear all errors
   */
  clearAllErrors(): void {
    this.errors = [];
    this.notifyListeners();
  }

  /**
   * Get all errors
   */
  getErrors(): FormEditorError[] {
    return [...this.errors];
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: 'error' | 'warning' | 'info'): FormEditorError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Get errors by code
   */
  getErrorsByCode(code: string): FormEditorError[] {
    return this.errors.filter(error => error.code === code);
  }

  /**
   * Get errors by context
   */
  getErrorsByContext(context: string): FormEditorError[] {
    return this.errors.filter(error => error.context === context);
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if there are any errors of specific severity
   */
  hasErrorsOfSeverity(severity: 'error' | 'warning' | 'info'): boolean {
    return this.errors.some(error => error.severity === severity);
  }

  /**
   * Subscribe to error changes
   */
  subscribe(listener: (errors: FormEditorError[]) => void): () => void {
    this.errorListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of error changes
   */
  private notifyListeners(): void {
    this.errorListeners.forEach(listener => {
      listener([...this.errors]);
    });
  }

  /**
   * Get error summary for display
   */
  getErrorSummary(): {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    retryable: number;
  } {
    return {
      total: this.errors.length,
      errors: this.getErrorsBySeverity('error').length,
      warnings: this.getErrorsBySeverity('warning').length,
      info: this.getErrorsBySeverity('info').length,
      retryable: this.errors.filter(e => e.retryable).length
    };
  }
}

// Common error codes and factories
export const ErrorCodes = {
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  DUPLICATE_VALUE: 'DUPLICATE_VALUE',
  
  // Save/Load errors
  SAVE_FAILED: 'SAVE_FAILED',
  LOAD_FAILED: 'LOAD_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // Tree/Node errors
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  INVALID_TREE_STRUCTURE: 'INVALID_TREE_STRUCTURE',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  
  // Form errors
  FORM_SYNC_FAILED: 'FORM_SYNC_FAILED',
  FIELD_UPDATE_FAILED: 'FIELD_UPDATE_FAILED',
  QUESTION_UPDATE_FAILED: 'QUESTION_UPDATE_FAILED',
  
  // Service errors
  SERVICE_SYNC_FAILED: 'SERVICE_SYNC_FAILED',
  SERVICE_CREATE_FAILED: 'SERVICE_CREATE_FAILED',
  SERVICE_UPDATE_FAILED: 'SERVICE_UPDATE_FAILED',
  SERVICE_DELETE_FAILED: 'SERVICE_DELETE_FAILED'
} as const;

export const ErrorFactory = {
  validationError: (message: string, context?: string, details?: Record<string, any>) => ({
    code: ErrorCodes.VALIDATION_FAILED,
    message,
    severity: 'error' as const,
    context,
    retryable: false,
    details
  }),

  saveError: (message: string, context?: string, retryable = true) => ({
    code: ErrorCodes.SAVE_FAILED,
    message,
    severity: 'error' as const,
    context,
    retryable,
    details: {}
  }),

  networkError: (message: string, context?: string) => ({
    code: ErrorCodes.NETWORK_ERROR,
    message,
    severity: 'error' as const,
    context,
    retryable: true,
    details: {}
  }),

  nodeError: (message: string, nodeId: string, context?: string) => ({
    code: ErrorCodes.NODE_NOT_FOUND,
    message,
    severity: 'error' as const,
    context,
    retryable: false,
    details: { nodeId }
  }),

  formSyncError: (message: string, fieldName: string, context?: string) => ({
    code: ErrorCodes.FORM_SYNC_FAILED,
    message,
    severity: 'warning' as const,
    context,
    retryable: true,
    details: { fieldName }
  }),

  serviceSyncError: (message: string, serviceId?: string, context?: string) => ({
    code: ErrorCodes.SERVICE_SYNC_FAILED,
    message,
    severity: 'warning' as const,
    context,
    retryable: true,
    details: { serviceId }
  })
};

// Default global error handler instance
export const globalErrorHandler = new FormEditorErrorHandler({
  enableLogging: process.env.NODE_ENV === 'development',
  showToasts: true
});

// Error boundary helper
export interface ErrorBoundaryInfo {
  componentStack: string;
}

export function handleReactError(
  error: Error,
  errorInfo: ErrorBoundaryInfo,
  context?: string
): FormEditorError {
  return globalErrorHandler.handleJSError(error, context, {
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString()
  });
}

// Utility functions for common error patterns
export const errorUtils = {
  /**
   * Wrap an async function with error handling
   */
  withErrorHandling: <T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: string,
    errorMessage?: string
  ) => {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        if (error instanceof FormEditorError) {
          throw error;
        }
        
        const jsError = error instanceof Error ? error : new Error(String(error));
        throw globalErrorHandler.handleJSError(
          jsError,
          context,
          { functionName: fn.name, arguments: args }
        );
      }
    };
  },

  /**
   * Create a validation error quickly
   */
  validationError: (field: string, message: string, context?: string) => {
    return globalErrorHandler.handleError(
      ErrorCodes.VALIDATION_FAILED,
      `${field}: ${message}`,
      { severity: 'error', context, retryable: false }
    );
  },

  /**
   * Check if error is retryable
   */
  isRetryable: (error: FormEditorError): boolean => {
    return error.retryable === true;
  },

  /**
   * Get user-friendly error message
   */
  getUserMessage: (error: FormEditorError): string => {
    // Map technical errors to user-friendly messages
    const userMessages: Record<string, string> = {
      [ErrorCodes.SAVE_FAILED]: 'Failed to save changes. Please try again.',
      [ErrorCodes.LOAD_FAILED]: 'Failed to load data. Please refresh the page.',
      [ErrorCodes.NETWORK_ERROR]: 'Network connection issue. Please check your internet connection.',
      [ErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
      [ErrorCodes.VALIDATION_FAILED]: 'Please fix the form errors before continuing.',
      [ErrorCodes.SERVICE_SYNC_FAILED]: 'Service synchronization issue. Changes may not be saved.',
      [ErrorCodes.FORM_SYNC_FAILED]: 'Form synchronization issue. Some fields may not update correctly.'
    };

    return userMessages[error.code] || error.message;
  }
};