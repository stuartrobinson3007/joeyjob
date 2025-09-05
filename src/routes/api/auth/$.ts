import { auth } from '@/lib/auth/auth'
import { createServerFileRoute } from '@tanstack/react-start/server'

export const ServerRoute = createServerFileRoute('/api/auth/$').methods({
  GET: async ({ request }) => {
    // All other endpoints use default Better Auth handling
    return auth.handler(request)
  },
  POST: ({ request }) => {
    return auth.handler(request)
  },
})