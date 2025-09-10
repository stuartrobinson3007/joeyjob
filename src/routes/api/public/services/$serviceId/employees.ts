import { createServerFileRoute } from '@tanstack/react-start/server'
import { getServiceEmployees } from '@/lib/simpro/employees.server'

export const ServerRoute = createServerFileRoute('/api/public/services/$serviceId/employees').methods({
    GET: async ({ params }) => {
        try {
            const { serviceId } = params
            if (!serviceId) {
                return Response.json({ error: 'Service ID is required' }, { status: 400 })
            }

            // This is a public endpoint for booking forms, so no auth required
            // Get employees assigned to this service
            const employees = await getServiceEmployees(serviceId)
            
            // Transform the data to match the Employee interface expected by the booking flow
            const transformedEmployees = employees.map(emp => ({
                id: emp.id,
                simproEmployeeId: emp.simproEmployeeId,
                name: emp.simproEmployeeName,
                email: emp.simproEmployeeEmail || undefined,
                isDefault: emp.isDefault
            }))

            return Response.json(transformedEmployees)
        } catch (error) {
            console.error('Error fetching service employees (public):', error)
            return Response.json(
                { error: error instanceof Error ? error.message : 'Failed to fetch employees' },
                { status: 500 }
            )
        }
    }
})