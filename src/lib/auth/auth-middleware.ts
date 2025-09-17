import { createMiddleware } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'

import { auth } from './auth'

import { AppError, ERROR_CODES } from '@/taali/utils/errors'

export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const request = getWebRequest()
  
  
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true }, // Always fetch fresh session data
  })
  


  if (!session) {
    throw new AppError(
      ERROR_CODES.AUTH_NOT_AUTHENTICATED,
      401,
      undefined,
      'Authentication required'
    )
  }

  return next({
    context: {
      user: session.user,
      session: session.session,
    },
  })
})
