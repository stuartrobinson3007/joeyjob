import { createServerFileRoute } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth/auth'
import { getOrganizationEmployees, toggleOrganizationEmployee } from '@/lib/simpro/employees.server'

export const ServerRoute = createServerFileRoute('/api/employees/').methods({
  GET: async ({ request }) => {
    try {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(request.url)
      const organizationId = url.searchParams.get('organizationId')
      
      if (!organizationId) {
        return Response.json({ error: 'Organization ID is required' }, { status: 400 })
      }

      const employees = await getOrganizationEmployees(organizationId)
      return Response.json(employees)
    } catch (error) {
      console.error('Error fetching employees:', error)
      return Response.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch employees' },
        { status: 500 }
      )
    }
  },
  
  PATCH: async ({ request }) => {
    try {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await request.json()
      const { organizationId, employeeId, isActive } = body
      
      if (!organizationId || !employeeId || typeof isActive !== 'boolean') {
        return Response.json({ error: 'Invalid request data' }, { status: 400 })
      }

      await toggleOrganizationEmployee(organizationId, employeeId, isActive)
      return Response.json({ success: true })
    } catch (error) {
      console.error('Error updating employee status:', error)
      return Response.json(
        { error: error instanceof Error ? error.message : 'Failed to update employee' },
        { status: 500 }
      )
    }
  }
})