import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { organizationEmployees, serviceEmployees, bookingEmployees } from '@/database/schema'
import { getEmployeesForUser } from './simpro.server'
import type { Employee } from './types'

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
        displayOnSchedule: emp.DisplayOnSchedule !== false,
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
            displayOnSchedule: emp.displayOnSchedule,
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
          isActive: false,
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
  isActive: boolean
) {
  await db
    .update(organizationEmployees)
    .set({
      isActive,
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
  // Remove existing assignments
  await db
    .delete(serviceEmployees)
    .where(eq(serviceEmployees.serviceId, serviceId))

  // Add new assignments
  if (employeeIds.length > 0) {
    const assignments = employeeIds.map(employeeId => ({
      serviceId,
      organizationEmployeeId: employeeId,
      isDefault: employeeId === defaultEmployeeId,
    }))

    await db.insert(serviceEmployees).values(assignments)
  }
}

/**
 * Get employees assigned to a service
 */
export async function getServiceEmployees(serviceId: string) {
  return await db
    .select({
      id: organizationEmployees.id,
      simproEmployeeId: organizationEmployees.simproEmployeeId,
      simproEmployeeName: organizationEmployees.simproEmployeeName,
      simproEmployeeEmail: organizationEmployees.simproEmployeeEmail,
      displayOnSchedule: organizationEmployees.displayOnSchedule,
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
        eq(organizationEmployees.isActive, true)
      )
    )
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