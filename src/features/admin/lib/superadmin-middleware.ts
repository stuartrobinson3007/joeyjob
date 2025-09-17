import { createMiddleware } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth/auth'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'

/**
 * Superadmin middleware that ensures the user is authenticated and has superadmin role
 * 
 * Usage:
 * ```typescript
 * export const adminFunction = createServerFn({ method: 'POST' })
 *   .middleware([superadminMiddleware])
 *   .handler(async ({ context }) => {
 *     // User is guaranteed to be authenticated and superadmin
 *     // ... admin logic
 *   })
 * ```
 */
export const superadminMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  // Use authMiddleware logic inline
  const request = getWebRequest()
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  })

  if (!session) {
    throw new AppError(
      ERROR_CODES.AUTH_NOT_AUTHENTICATED,
      401,
      undefined,
      'Authentication required'
    )
  }

  // Verify user has superadmin role
  if (session.user.role !== 'superadmin') {
    throw AppError.forbidden('Superadmin access required')
  }

  // User is authenticated and has superadmin role
  return next({
    context: {
      user: session.user,
      session: session.session,
    },
  })
})