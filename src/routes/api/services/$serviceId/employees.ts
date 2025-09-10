import { createServerFileRoute } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth/auth'
import { 
    getServiceEmployees, 
    assignEmployeesToService 
} from '@/lib/simpro/employees.server'

export const ServerRoute = createServerFileRoute('/api/services/$serviceId/employees').methods({
    GET: async ({ request, params }) => {
        try {
            const session = await auth.api.getSession({ headers: request.headers })
            if (!session) {
                return Response.json({ error: 'Unauthorized' }, { status: 401 })
            }

            const { serviceId } = params
            if (!serviceId) {
                return Response.json({ error: 'Service ID is required' }, { status: 400 })
            }

            const employees = await getServiceEmployees(serviceId)
            return Response.json(employees)
        } catch (error) {
            console.error('Error fetching service employees:', error)
            return Response.json(
                { error: error instanceof Error ? error.message : 'Failed to fetch service employees' },
                { status: 500 }
            )
        }
    },

    PUT: async ({ request, params }) => {
        try {
            const session = await auth.api.getSession({ headers: request.headers })
            if (!session) {
                return Response.json({ error: 'Unauthorized' }, { status: 401 })
            }

            const { serviceId } = params
            if (!serviceId) {
                return Response.json({ error: 'Service ID is required' }, { status: 400 })
            }

            const body = await request.json()
            const { employeeIds, defaultEmployeeId } = body
            
            if (!Array.isArray(employeeIds)) {
                return Response.json({ error: 'Employee IDs must be an array' }, { status: 400 })
            }

            await assignEmployeesToService(serviceId, employeeIds, defaultEmployeeId)
            return Response.json({ success: true })
        } catch (error) {
            console.error('Error updating service employees:', error)
            return Response.json(
                { error: error instanceof Error ? error.message : 'Failed to update service employees' },
                { status: 500 }
            )
        }
    }
})