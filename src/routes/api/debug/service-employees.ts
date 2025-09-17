import { createServerFileRoute } from '@tanstack/react-start/server'
import { db } from '@/lib/db/db'
import { serviceEmployees, organizationEmployees, services } from '@/database/schema'
import { eq } from 'drizzle-orm'

export const ServerRoute = createServerFileRoute('/api/debug/service-employees').methods({
    GET: async ({ request }) => {
        console.log('🔍 [DEBUG ENDPOINT] Service employees debug requested')
        
        try {
            const url = new URL(request.url)
            const serviceId = url.searchParams.get('serviceId')
            
            // Get all service-employee assignments
            const allServiceEmployees = await db
                .select()
                .from(serviceEmployees)
                .limit(50)
                
            
            // Get all organization employees
            const allOrgEmployees = await db
                .select()
                .from(organizationEmployees)
                .limit(50)
                
            
            // Get all services
            const allServices = await db
                .select({
                    id: services.id,
                    name: services.name,
                    organizationId: services.organizationId
                })
                .from(services)
                .limit(50)
                
            
            let specificServiceData = null
            if (serviceId) {
                // Get specific service data
                const serviceData = await db
                    .select()
                    .from(services)
                    .where(eq(services.id, serviceId))
                    .limit(1)
                    
                const serviceEmployeeData = await db
                    .select()
                    .from(serviceEmployees)
                    .where(eq(serviceEmployees.serviceId, serviceId))
                    
                const joinedData = await db
                    .select({
                        serviceEmployee: serviceEmployees,
                        orgEmployee: organizationEmployees
                    })
                    .from(serviceEmployees)
                    .innerJoin(
                        organizationEmployees,
                        eq(serviceEmployees.organizationEmployeeId, organizationEmployees.id)
                    )
                    .where(eq(serviceEmployees.serviceId, serviceId))
                    
                specificServiceData = {
                    serviceId,
                    serviceExists: serviceData.length > 0,
                    service: serviceData[0] || null,
                    rawAssignments: serviceEmployeeData,
                    joinedEmployees: joinedData
                }
                
            }
            
            const debugInfo = {
                timestamp: new Date().toISOString(),
                serviceId: serviceId || null,
                totalServiceEmployeeAssignments: allServiceEmployees.length,
                totalOrganizationEmployees: allOrgEmployees.length,
                totalServices: allServices.length,
                allServiceEmployees: allServiceEmployees,
                allOrganizationEmployees: allOrgEmployees,
                allServices: allServices,
                specificServiceData
            }
            
            return Response.json(debugInfo, { 
                headers: { 'Content-Type': 'application/json' },
                status: 200 
            })
        } catch (error) {
            console.error('❌ [DEBUG ENDPOINT] Error:', error)
            return Response.json(
                { error: error instanceof Error ? error.message : 'Debug query failed' },
                { status: 500 }
            )
        }
    }
})