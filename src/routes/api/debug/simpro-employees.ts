import { createServerFileRoute } from '@tanstack/react-start/server'
import { getEmployeesForUser } from '@/lib/simpro/simpro.server'
import { auth } from '@/lib/auth/auth'

export const ServerRoute = createServerFileRoute('/api/debug/simpro-employees').methods({
    GET: async ({ request }) => {
        console.log('🔍 [DEBUG ENDPOINT] SimPro employees raw response requested')
        
        try {
            // Get authenticated user
            const session = await auth.api.getSession({ headers: request.headers })
            if (!session?.userId) {
                return Response.json(
                    { error: 'Unauthorized - no session found' },
                    { status: 401 }
                )
            }
            
            const userId = session.userId
            console.log('🔍 [DEBUG] Fetching SimPro employees for user:', userId)
            
            // Get raw employees data from SimPro API
            const simproEmployees = await getEmployeesForUser(userId)
            
            // Log the first employee to see structure
            if (simproEmployees.length > 0) {
                console.log('🔍 [DEBUG] First employee raw data:', JSON.stringify(simproEmployees[0], null, 2))
            }
            
            const debugInfo = {
                timestamp: new Date().toISOString(),
                userId,
                totalEmployees: simproEmployees.length,
                rawEmployees: simproEmployees,
                firstEmployeeStructure: simproEmployees[0] || null,
                displayOnSchedulePresent: simproEmployees.length > 0 ? 
                    'DisplayOnSchedule' in simproEmployees[0] : false,
                employeesWithDisplayOnSchedule: simproEmployees.filter(
                    (emp: any) => 'DisplayOnSchedule' in emp
                ).length,
                employeesDisplayOnScheduleTrue: simproEmployees.filter(
                    (emp: any) => emp.DisplayOnSchedule === true
                ).length,
                employeesDisplayOnScheduleFalse: simproEmployees.filter(
                    (emp: any) => emp.DisplayOnSchedule === false
                ).length,
                employeesDisplayOnScheduleUndefined: simproEmployees.filter(
                    (emp: any) => emp.DisplayOnSchedule === undefined
                ).length,
            }
            
            return Response.json(debugInfo, { 
                headers: { 'Content-Type': 'application/json' },
                status: 200 
            })
        } catch (error) {
            console.error('❌ [DEBUG ENDPOINT] Error:', error)
            return Response.json(
                { 
                    error: error instanceof Error ? error.message : 'Failed to fetch SimPro employees',
                    stack: error instanceof Error ? error.stack : undefined
                },
                { status: 500 }
            )
        }
    }
})