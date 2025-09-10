import { createServerFileRoute } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth/auth'
import { syncOrganizationEmployees } from '@/lib/simpro/employees.server'

export const ServerRoute = createServerFileRoute('/api/employees/sync').methods({
  POST: async ({ request }) => {
    try {
      // Get the session from request
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await request.json()
      const { organizationId } = body
      if (!organizationId) {
        return Response.json({ error: 'Organization ID is required' }, { status: 400 })
      }

      // Sync employees from Simpro
      const result = await syncOrganizationEmployees(organizationId, session.user.id)

      return Response.json(result)
    } catch (error) {
      console.error('Error syncing employees:', error)
      return Response.json(
        { error: error instanceof Error ? error.message : 'Failed to sync employees' },
        { status: 500 }
      )
    }
  }
})