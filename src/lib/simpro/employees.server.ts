import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { organizationEmployees, serviceEmployees, bookingEmployees } from '@/database/schema'
import { getEmployeesForUser } from './simpro.server'

/**
 * Sync organization employees from Simpro
 */
export async function syncOrganizationEmployees(organizationId: string, userId: string) {
  try {
    // Fetch employees from Simpro
    const simproEmployees = await getEmployeesForUser(userId)

    // Get existing organization employees
    const existingEmployees = await db
      .select()
      .from(organizationEmployees)
      .where(eq(organizationEmployees.organizationId, organizationId))

    const existingEmployeeIds = new Set(
      existingEmployees.map(emp => emp.simproEmployeeId)
    )

    // Prepare employees to insert/update
    const employeesToUpsert = simproEmployees
      .filter(emp => emp.Active !== false) // Only sync active employees
      .map(emp => ({
        organizationId,
        simproEmployeeId: emp.ID,
        simproEmployeeName: emp.Name,
        simproEmployeeEmail: emp.Email || null,
        isActive: true,
        lastSyncAt: new Date(),
        syncError: null,
        createdBy: userId,
      }))

    // Insert new employees
    const newEmployees = employeesToUpsert.filter(
      emp => !existingEmployeeIds.has(emp.simproEmployeeId)
    )

    if (newEmployees.length > 0) {
      await db.insert(organizationEmployees).values(newEmployees)
    }

    // Update existing employees
    for (const emp of employeesToUpsert) {
      if (existingEmployeeIds.has(emp.simproEmployeeId)) {
        await db
          .update(organizationEmployees)
          .set({
            simproEmployeeName: emp.simproEmployeeName,
            simproEmployeeEmail: emp.simproEmployeeEmail,
            lastSyncAt: emp.lastSyncAt,
            syncError: null,
          })
          .where(
            and(
              eq(organizationEmployees.organizationId, organizationId),
              eq(organizationEmployees.simproEmployeeId, emp.simproEmployeeId)
            )
          )
      }
    }

    // Mark employees that are no longer in Simpro as inactive
    const currentSimproIds = simproEmployees.map(emp => emp.ID)
    if (currentSimproIds.length > 0) {
      await db
        .update(organizationEmployees)
        .set({
          isEnabled: false,
          lastSyncAt: new Date(),
        })
        .where(
          and(
            eq(organizationEmployees.organizationId, organizationId),
            inArray(organizationEmployees.simproEmployeeId, currentSimproIds)
          )
        )
    }

    return {
      success: true,
      syncedCount: employeesToUpsert.length,
      newCount: newEmployees.length,
    }
  } catch (error) {
    console.error('Error syncing organization employees:', error)
    
    // Log sync error for existing employees
    await db
      .update(organizationEmployees)
      .set({
        syncError: error instanceof Error ? error.message : 'Unknown sync error',
        lastSyncAt: new Date(),
      })
      .where(eq(organizationEmployees.organizationId, organizationId))

    throw error
  }
}

/**
 * Get organization employees
 */
export async function getOrganizationEmployees(organizationId: string) {
  return await db
    .select()
    .from(organizationEmployees)
    .where(eq(organizationEmployees.organizationId, organizationId))
}

/**
 * Toggle employee selection for organization
 */
export async function toggleOrganizationEmployee(
  organizationId: string,
  employeeId: string,
  isEnabled: boolean
) {
  await db
    .update(organizationEmployees)
    .set({
      isEnabled,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizationEmployees.organizationId, organizationId),
        eq(organizationEmployees.id, employeeId)
      )
    )
}

/**
 * Assign employees to a service
 */
export async function assignEmployeesToService(
  serviceId: string,
  employeeIds: string[],
  defaultEmployeeId?: string
) {
  console.log('👥 [ASSIGN EMPLOYEES] Starting assignment:', {
    serviceId,
    serviceIdType: typeof serviceId,
    serviceIdLength: serviceId?.length,
    employeeIds,
    employeeIdsLength: employeeIds.length,
    defaultEmployeeId
  })

  // First check existing assignments
  const existingAssignments = await db
    .select()
    .from(serviceEmployees)
    .where(eq(serviceEmployees.serviceId, serviceId))
    
  console.log('👥 [ASSIGN EMPLOYEES] Existing assignments before deletion:', {
    count: existingAssignments.length,
    assignments: existingAssignments
  })

  // Remove existing assignments
  console.log('👥 [ASSIGN EMPLOYEES] Deleting existing assignments for serviceId:', serviceId)
  const deleteResult = await db
    .delete(serviceEmployees)
    .where(eq(serviceEmployees.serviceId, serviceId))
    
  console.log('👥 [ASSIGN EMPLOYEES] Delete result:', deleteResult)

  // Add new assignments
  if (employeeIds.length > 0) {
    const assignments = employeeIds.map(employeeId => ({
      serviceId,
      organizationEmployeeId: employeeId,
      isDefault: employeeId === defaultEmployeeId,
    }))

    console.log('👥 [ASSIGN EMPLOYEES] Creating new assignments:', assignments)
    const insertResult = await db.insert(serviceEmployees).values(assignments)
    console.log('👥 [ASSIGN EMPLOYEES] Insert result:', insertResult)
    
    // Verify the assignments were created
    const verifyAssignments = await db
      .select()
      .from(serviceEmployees)
      .where(eq(serviceEmployees.serviceId, serviceId))
      
    console.log('👥 [ASSIGN EMPLOYEES] Verification - assignments after insert:', {
      count: verifyAssignments.length,
      assignments: verifyAssignments
    })
  } else {
    console.log('👥 [ASSIGN EMPLOYEES] No employees to assign - assignments cleared')
  }
}

/**
 * Get employees assigned to a service
 * @param serviceId - The service ID
 * @param checkAvailability - Whether to check Simpro for availability when form loads (default: false)
 */
export async function getServiceEmployees(serviceId: string, checkAvailability: boolean = false) {
  console.log('📋 [GET SERVICE EMPLOYEES] Called with:', {
    serviceId,
    serviceIdType: typeof serviceId,
    serviceIdLength: serviceId?.length,
    checkAvailability
  })
  
  // First, check if any serviceEmployees records exist for this service at all
  console.log('🔍 [DB DEBUG] Checking serviceEmployees table for serviceId:', serviceId)
  const serviceEmployeeRecords = await db
    .select()
    .from(serviceEmployees)
    .where(eq(serviceEmployees.serviceId, serviceId))
  
  console.log('🔍 [DB DEBUG] Raw serviceEmployees records found:', {
    count: serviceEmployeeRecords.length,
    records: serviceEmployeeRecords
  })
  
  // Also check what serviceEmployee records exist in general  
  const allServiceEmployees = await db
    .select({
      serviceId: serviceEmployees.serviceId,
      organizationEmployeeId: serviceEmployees.organizationEmployeeId,
      isDefault: serviceEmployees.isDefault
    })
    .from(serviceEmployees)
    .limit(10)
  
  console.log('🔍 [DB DEBUG] Sample of all serviceEmployees records:', allServiceEmployees)
  
  // Check if organizationEmployees exist
  const organizationEmployeeCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(organizationEmployees)
    .where(eq(organizationEmployees.isEnabled, true))
    
  console.log('🔍 [DB DEBUG] Active organizationEmployees count:', organizationEmployeeCount[0]?.count || 0)
  
  // Now run the main query with detailed logging
  console.log('🔍 [DB DEBUG] Running main query with JOIN...')
  const employees = await db
    .select({
      id: organizationEmployees.id,
      simproEmployeeId: organizationEmployees.simproEmployeeId,
      simproEmployeeName: organizationEmployees.simproEmployeeName,
      simproEmployeeEmail: organizationEmployees.simproEmployeeEmail,
      isDefault: serviceEmployees.isDefault,
    })
    .from(serviceEmployees)
    .innerJoin(
      organizationEmployees,
      eq(serviceEmployees.organizationEmployeeId, organizationEmployees.id)
    )
    .where(
      and(
        eq(serviceEmployees.serviceId, serviceId),
        eq(organizationEmployees.isEnabled, true)
      )
    )

  console.log('📋 [GET SERVICE EMPLOYEES] Found employees from DB:', {
    count: employees.length,
    employees: employees.map(e => ({
      name: e.simproEmployeeName,
      id: e.id,
      simproId: e.simproEmployeeId,
      isDefault: e.isDefault
    }))
  })

  // If availability checking is not requested, return all employees
  if (!checkAvailability) {
    console.log('⏭️ [GET SERVICE EMPLOYEES] Availability checking disabled, returning all employees')
    return employees
  }

  console.log('🔍 [GET SERVICE EMPLOYEES] Availability checking ENABLED, checking Simpro...')
  
  // Check Simpro availability for the employees
  try {
    const { checkEmployeesAvailabilityInSimpro } = await import('./availability.server')
    const availableEmployees = await checkEmployeesAvailabilityInSimpro(employees, serviceId)
    
    console.log('✅ [GET SERVICE EMPLOYEES] Availability check complete:', {
      originalCount: employees.length,
      availableCount: availableEmployees.length,
      filteredOut: employees.length - availableEmployees.length
    })
    
    return availableEmployees
  } catch (error) {
    console.error('❌ [GET SERVICE EMPLOYEES] Error checking employee availability:', error)
    console.log('⚠️ [GET SERVICE EMPLOYEES] Falling back to returning all employees')
    // On error, return all employees (graceful degradation)
    return employees
  }
}

/**
 * Assign employee to a booking
 */
export async function assignEmployeeToBooking(
  bookingId: string,
  organizationEmployeeId: string,
  simproData?: {
    jobId?: number
    customerId?: number
    scheduleId?: number
    siteId?: number
  }
) {
  // Remove existing assignment
  await db
    .delete(bookingEmployees)
    .where(eq(bookingEmployees.bookingId, bookingId))

  // Add new assignment
  await db.insert(bookingEmployees).values({
    bookingId,
    organizationEmployeeId,
    simproJobId: simproData?.jobId || null,
    simproCustomerId: simproData?.customerId || null,
    simproScheduleId: simproData?.scheduleId || null,
    simproSiteId: simproData?.siteId || null,
    simproStatus: 'pending',
  })
}

/**
 * Update booking Simpro sync status
 */
export async function updateBookingSimproStatus(
  bookingId: string,
  status: string,
  simproData?: {
    jobId?: number
    customerId?: number
    scheduleId?: number
    siteId?: number
  },
  error?: string
) {
  await db
    .update(bookingEmployees)
    .set({
      simproStatus: status,
      simproJobId: simproData?.jobId || undefined,
      simproCustomerId: simproData?.customerId || undefined,
      simproScheduleId: simproData?.scheduleId || undefined,
      simproSiteId: simproData?.siteId || undefined,
      simproSyncError: error || null,
      lastSimproSync: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookingEmployees.bookingId, bookingId))
}

/**
 * Get booking employee assignment
 */
export async function getBookingEmployee(bookingId: string) {
  const result = await db
    .select({
      organizationEmployee: organizationEmployees,
      bookingEmployee: bookingEmployees,
    })
    .from(bookingEmployees)
    .innerJoin(
      organizationEmployees,
      eq(bookingEmployees.organizationEmployeeId, organizationEmployees.id)
    )
    .where(eq(bookingEmployees.bookingId, bookingId))
    .limit(1)

  return result[0] || null
}