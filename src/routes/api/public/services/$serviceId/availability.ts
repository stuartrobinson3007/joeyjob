import { createServerFileRoute } from '@tanstack/react-start/server'
import { db } from '@/lib/db/db'
import { organizationEmployees, member } from '@/database/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getServiceAvailability } from '@/lib/simpro/availability-optimized.server'

export const ServerRoute = createServerFileRoute('/api/public/services/$serviceId/availability').methods({
    POST: async ({ params, request }) => {
        console.log('📅 [SERVICE AVAILABILITY API] POST request for service:', params.serviceId)
        
        try {
            const { serviceId } = params
            if (!serviceId) {
                console.error('❌ [SERVICE AVAILABILITY API] No service ID provided')
                return Response.json({ error: 'Service ID is required' }, { status: 400 })
            }

            // Get request body with service settings
            const body = await request.json()
            const { year, month, organizationId, serviceSettings } = body
            
            console.log('📅 [SERVICE AVAILABILITY API] Request data:', {
                serviceId,
                year,
                month,
                organizationId,
                serviceSettings: serviceSettings ? Object.keys(serviceSettings) : 'missing'
            })

            if (!year || !month || !organizationId || !serviceSettings) {
                return Response.json({ error: 'year, month, organizationId, and serviceSettings are required' }, { status: 400 })
            }

            // Get assigned employee IDs from service settings
            const assignedEmployeeIds = serviceSettings.assignedEmployeeIds || []
            if (assignedEmployeeIds.length === 0) {
                console.log('⚠️ [SERVICE AVAILABILITY API] No employees assigned to this service')
                return Response.json({})
            }

            // Get organization member for Simpro API access
            const orgMember = await db
                .select({ userId: member.userId })
                .from(member)
                .where(eq(member.organizationId, organizationId))
                .limit(1)

            if (!orgMember.length) {
                console.warn('⚠️ [SERVICE AVAILABILITY API] No organization member found')
                return Response.json({})
            }

            // Get employee data from database
            const employees = await db
                .select({
                    id: organizationEmployees.id,
                    simproEmployeeId: organizationEmployees.simproEmployeeId,
                })
                .from(organizationEmployees)
                .where(and(
                    eq(organizationEmployees.organizationId, organizationId),
                    inArray(organizationEmployees.id, assignedEmployeeIds),
                    eq(organizationEmployees.isActive, true)
                ))

            if (employees.length === 0) {
                console.log('⚠️ [SERVICE AVAILABILITY API] No active employees found')
                return Response.json({})
            }

            // Extract Simpro employee IDs
            const simproEmployeeIds = employees.map(e => e.simproEmployeeId)

            // Use optimized availability calculation
            const availability = await getServiceAvailability(
                orgMember[0].userId,
                simproEmployeeIds,
                {
                    duration: serviceSettings.duration || 30,
                    interval: serviceSettings.interval || 30,
                    bufferTime: serviceSettings.bufferTime || 15,
                    minimumNotice: serviceSettings.minimumNotice || 0
                },
                year,
                month
            )

            console.log('✅ [SERVICE AVAILABILITY API] Returning availability data:', {
                employeeCount: employees.length,
                availableDatesCount: Object.keys(availability).length,
                totalSlots: Object.values(availability).reduce((sum, slots) => sum + slots.length, 0)
            })

            return Response.json(availability)
            
        } catch (error) {
            console.error('❌ [SERVICE AVAILABILITY API] Error:', error)
            return Response.json(
                { error: error instanceof Error ? error.message : 'Failed to get service availability' },
                { status: 500 }
            )
        }
    }
})


