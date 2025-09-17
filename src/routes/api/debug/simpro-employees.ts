import { createServerFileRoute } from '@tanstack/react-start/server'
import { getEmployeesForOrganization } from '@/lib/simpro/simpro.server'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { member } from '@/database/schema'
import { eq } from 'drizzle-orm'

export const ServerRoute = createServerFileRoute('/api/debug/simpro-employees').methods({
    GET: async ({ request }) => {
        console.log('🔍 [DEBUG ENDPOINT] SimPro employees raw response requested')
        
        try {
            // Get authenticated user
            const session = await auth.api.getSession({ headers: request.headers })
            if (!session?.user?.id) {
                return Response.json(
                    { error: 'Unauthorized - no session found' },
                    { status: 401 }
                )
            }
            
            const userId = session.user.id
            
            // Get user's organization
            const members = await db
                .select({ organizationId: member.organizationId })
                .from(member)
                .where(eq(member.userId, userId))
                .limit(1)
            
            if (!members.length) {
                return Response.json(
                    { error: 'User not a member of any organization' },
                    { status: 400 }
                )
            }
            
            const organizationId = members[0].organizationId
            
            // Get raw employees data from SimPro API
            const simproEmployees = await getEmployeesForOrganization(organizationId)
            
            // Log the first employee to see structure
            if (simproEmployees.length > 0) {
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