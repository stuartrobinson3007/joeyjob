import { ERROR_CODES, type ErrorCode } from '@/lib/errors/codes'

export { ERROR_CODES } from '@/lib/errors/codes'

export interface ErrorContext {
  [key: string]: unknown
}

export interface ErrorAction {
  action: 'retry' | 'login' | 'upgrade' | 'support' | 'goBack'
  label?: string
  data?: unknown
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode | string,
    public statusCode: number = 500,
    public context?: ErrorContext,
    public fallbackMessage?: string,
    public actions?: ErrorAction[]
  ) {
    // Use fallback message for Error.message (for logs/debugging)
    super(fallbackMessage || code)
    this.name = 'AppError'
  }

  // Helper to create common errors
  static notFound(resource: string): AppError {
    return new AppError(ERROR_CODES.BIZ_NOT_FOUND, 404, { resource }, `${resource} not found`)
  }

  static unauthorized(message?: string): AppError {
    return new AppError(
      ERROR_CODES.AUTH_NOT_AUTHENTICATED,
      401,
      undefined,
      message || 'Authentication required'
    )
  }

  static forbidden(action?: string): AppError {
    return new AppError(
      ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
      403,
      { action },
      `Insufficient permissions${action ? ` for ${action}` : ''}`
    )
  }

  static validation(fields: Record<string, string | string[]>): AppError {
    return new AppError(ERROR_CODES.VAL_INVALID_FORMAT, 400, { fields }, 'Validation failed')
  }

  static limitExceeded(resource: string): AppError {
    return new AppError(
      ERROR_CODES.BIZ_LIMIT_EXCEEDED,
      403,
      { resource },
      `Limit exceeded for ${resource}`,
      [{ action: 'upgrade' }]
    )
  }
}

// Keep existing error classes but update them to use codes
export class AuthError extends AppError {
  constructor(
    code: ErrorCode = ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    fallbackMessage: string = 'Authentication failed'
  ) {
    super(code, 401, undefined, fallbackMessage)
    this.name = 'AuthError'
  }
}

export class PermissionError extends AppError {
  constructor(action?: string, fallbackMessage: string = 'Permission denied') {
    super(ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS, 403, { action }, fallbackMessage)
    this.name = 'PermissionError'
  }
}

export class ValidationError extends AppError {
  constructor(
    fields: Record<string, string | string[]>,
    fallbackMessage: string = 'Validation failed'
  ) {
    super(ERROR_CODES.VAL_INVALID_FORMAT, 400, { fields }, fallbackMessage)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(ERROR_CODES.BIZ_NOT_FOUND, 404, { resource }, `${resource} not found`)
    this.name = 'NotFoundError'
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

// Legacy handleError function - kept for backward compatibility
export function handleError(error: unknown): {
  userMessage: string
  technicalMessage: string
  statusCode: number
  context?: ErrorContext
} {
  if (isAppError(error)) {
    return {
      userMessage: error.fallbackMessage || error.code,
      technicalMessage: error.fallbackMessage || error.message,
      statusCode: error.statusCode,
      context: error.context,
    }
  }

  if (error instanceof Error) {
    // Error is being thrown for handling
    return {
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error.message,
      statusCode: 500,
    }
  }

  // Unknown error type, throwing generic error
  return {
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalMessage: 'Unknown error',
    statusCode: 500,
  }
}
