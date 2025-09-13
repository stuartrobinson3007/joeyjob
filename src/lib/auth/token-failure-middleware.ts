import { createMiddleware } from '@tanstack/react-start'

import { AppError, ERROR_CODES, isAppError, type ErrorContext } from '@/taali/utils/errors'

/**
 * Middleware to enhance token-related errors with connection update actions
 * This middleware catches token failures and adds appropriate recovery actions
 */
export const tokenFailureMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      // Enhance token-related errors with update connection actions
      if (isAppError(error)) {
        const isTokenError = [
          ERROR_CODES.SYS_TOKEN_REFRESH_FAILED,
          ERROR_CODES.SYS_TOKEN_INVALID,
          ERROR_CODES.AUTH_SESSION_EXPIRED
        ].includes(error.code as any)
        
        if (isTokenError && (!error.actions || error.actions.length === 0)) {
          // Add update connection action if not already present
          error.actions = [{ action: 'updateConnection', label: 'Update Connection' }]
        }
      }
      
      // Re-throw the error (potentially enhanced)
      throw error
    }
  })

/**
 * Utility function to create enhanced token refresh errors
 * Use this when creating new token-related errors to ensure consistency
 */
export function createTokenRefreshError(
  code: string,
  statusCode: number,
  context: ErrorContext,
  message: string
): AppError {
  return new AppError(
    code,
    statusCode,
    context,
    message,
    [{ action: 'updateConnection', label: 'Update Connection' }]
  )
}