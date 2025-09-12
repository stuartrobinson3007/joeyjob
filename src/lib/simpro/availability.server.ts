import { db } from '@/lib/db/db'
import { eq } from 'drizzle-orm'
import { services, member } from '@/database/schema'
import { getAvailableEmployeesForBooking } from './booking-employee-selection.server'

/**
 * Check if employees are available in Simpro for a specific date/time range
 * Returns only employees who have availability for that time slot
 */
export async function checkEmployeesAvailabilityForTimeSlot(
  employees: Array<{
    id: string
    simproEmployeeId: number
    simproEmployeeName: string
    simproEmployeeEmail?: string | null
    isDefault: boolean
  }>,
  serviceId: string,
  date: Date,
  startTime: string,
  endTime: string
): Promise<typeof employees> {
  
  try {
    // If no employees, return empty array
    if (!employees || employees.length === 0) {
      return []
    }

    // Get service details to find organization and user
    const serviceData = await db
      .select({
        organizationId: services.organizationId,
      })
      .from(services)
      .where(eq(services.id, serviceId))
      .limit(1)

    if (!serviceData.length) {
      return employees // Graceful degradation
    }


    // Get a user from the organization who has Simpro configured
    const orgMember = await db
      .select({
        userId: member.userId,
      })
      .from(member)
      .where(eq(member.organizationId, serviceData[0].organizationId))
      .limit(1)

    if (!orgMember.length) {
      return employees // Graceful degradation
    }

    const userId = orgMember[0].userId

    // Note: Simpro API access verified during organization setup
    // No need to test it again here since detailed availability checking
    // is handled by optimized calendar and booking selection functions

    // Check availability for each employee for the specific date
    const dateStr = date.toISOString().split('T')[0]

    // Convert date and time for the shared availability function
    const checkDate = new Date(`${dateStr}T${startTime}`)
    
    // Use shared availability function to find truly available employees
    const availableEmployees = await getAvailableEmployeesForBooking(
        employees.map(e => e.simproEmployeeId),
        checkDate,
        startTime, // Assumes this is in 12h format like "9:00am"
        {
            duration: calculateDurationInMinutes(startTime, endTime),
            interval: 30,
            bufferTime: 15,
            minimumNotice: 0
        },
        serviceData[0].organizationId,
        userId,
        new Map(employees.map(emp => [emp.simproEmployeeId, { isDefault: emp.isDefault }]))
    )

    
    // Convert back to the original format
    const resultEmployees = employees.filter(emp => 
        availableEmployees.some(avail => avail.employeeId === emp.simproEmployeeId)
    )
    
    return resultEmployees
  } catch (error) {
    console.error('❌ [SIMPRO AVAILABILITY CHECK] Error checking employee availability:', error)
    // On any error, return all employees (graceful degradation)
    return employees
  }
}

/**
 * Check if employees are available in Simpro (general availability check)
 * 
 * SIMPLIFIED: Since detailed availability is now handled by optimized calendar
 * and booking selection, this function now returns all assigned employees.
 * The specific availability checking happens at booking time.
 */
export async function checkEmployeesAvailabilityInSimpro(
  employees: Array<{
    id: string
    simproEmployeeId: number
    simproEmployeeName: string
    simproEmployeeEmail?: string | null
    isDefault: boolean
  }>,
  serviceId: string
): Promise<typeof employees> {
  
  // Return all employees - detailed availability checking is now done by:
  // 1. Optimized calendar generation (shows available time slots)  
  // 2. Booking employee selection (selects specific employee at booking time)
  return employees
}

/**
 * Get organization user ID for Simpro API calls
 * Helper function to find a user in the organization who has Simpro configured
 */
export async function getOrganizationUserForSimpro(organizationId: string): Promise<string | null> {
  try {
    const orgMember = await db
      .select({
        userId: member.userId,
      })
      .from(member)
      .where(eq(member.organizationId, organizationId))
      .limit(1)

    return orgMember[0]?.userId || null
  } catch (error) {
    console.error('Error getting organization user for Simpro:', error)
    return null
  }
}

/**
 * Helper function to calculate duration in minutes from start and end times
 */
function calculateDurationInMinutes(startTime: string, endTime: string): number {
    try {
        const start = new Date(`1970-01-01T${startTime}`)
        const end = new Date(`1970-01-01T${endTime}`)
        return Math.floor((end.getTime() - start.getTime()) / 60000)
    } catch (error) {
        console.warn('Could not calculate duration, defaulting to 30 minutes:', { startTime, endTime })
        return 30 // Default duration
    }
}