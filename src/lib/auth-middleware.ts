import { createMiddleware } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { auth } from './auth'

export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const request = getWebRequest()
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true } // Always fetch fresh session data
  })

  console.log('🛡️ Auth Middleware - Retrieved session:',
    session ? { userId: session.user.id, email: session.user.email, onboardingCompleted: session.user.onboardingCompleted } : null
  )

  if (!session) {
    throw new Error('Unauthorized')
  }

  return next({
    context: {
      user: session.user,
      session: session.session
    }
  })
})