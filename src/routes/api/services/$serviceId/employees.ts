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
        console.log('📝 [FORM EDITOR API] Employee assignment PUT request received')
        
        try {
            const session = await auth.api.getSession({ headers: request.headers })
            if (!session) {
                console.error('❌ [FORM EDITOR API] Unauthorized - no session')
                return Response.json({ error: 'Unauthorized' }, { status: 401 })
            }

            console.log('✅ [FORM EDITOR API] Authenticated user:', session.user?.id)

            const { serviceId } = params
            if (!serviceId) {
                console.error('❌ [FORM EDITOR API] No service ID provided')
                return Response.json({ error: 'Service ID is required' }, { status: 400 })
            }

            console.log('📝 [FORM EDITOR API] Service ID:', serviceId)

            const body = await request.json()
            const { employeeIds, defaultEmployeeId } = body
            
            console.log('📝 [FORM EDITOR API] Request body:', {
                employeeIds,
                employeeIdsType: typeof employeeIds,
                employeeIdsLength: Array.isArray(employeeIds) ? employeeIds.length : 'not array',
                defaultEmployeeId
            })
            
            if (!Array.isArray(employeeIds)) {
                console.error('❌ [FORM EDITOR API] Employee IDs is not an array:', employeeIds)
                return Response.json({ error: 'Employee IDs must be an array' }, { status: 400 })
            }

            console.log('🔄 [FORM EDITOR API] Calling assignEmployeesToService...')
            await assignEmployeesToService(serviceId, employeeIds, defaultEmployeeId)
            
            console.log('✅ [FORM EDITOR API] Employee assignment completed successfully')
            return Response.json({ success: true })
        } catch (error) {
            console.error('❌ [FORM EDITOR API] Error updating service employees:', error)
            return Response.json(
                { error: error instanceof Error ? error.message : 'Failed to update service employees' },
                { status: 500 }
            )
        }
    }
})