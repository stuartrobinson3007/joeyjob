import { createMiddleware } from '@tanstack/react-start'
import { auth } from './auth'

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await auth.api.getSession()

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