import { createServerFileRoute } from '@tanstack/react-start/server'
import { 
  getEmployeesForOrganization, 
  toggleEmployeeEnabled 
} from '@/lib/employees/server'

export const ServerRoute = createServerFileRoute('/api/employees/').methods({
  GET: async ({ request }) => {
    try {
      // Use new middleware-based server function
      const result = await getEmployeesForOrganization()
      return Response.json(result.employees)
    } catch (error) {
      console.error('Error fetching employees for user:', error)
      return Response.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch employees' },
        { status: 500 }
      )
    }
  },
  
  PATCH: async ({ request }) => {
    try {
      const body = await request.json()
      const { employeeId, enabled } = body
      
      if (!employeeId || typeof enabled !== 'boolean') {
        return Response.json({ error: 'Invalid request data' }, { status: 400 })
      }

      // Use new middleware-based server function
      const result = await toggleEmployeeEnabled({ 
        employeeId, 
        enabled 
      })
      
      return Response.json(result)
    } catch (error) {
      console.error('Error updating employee status:', error)
      return Response.json(
        { error: error instanceof Error ? error.message : 'Failed to update employee' },
        { status: 500 }
      )
    }
  },
})