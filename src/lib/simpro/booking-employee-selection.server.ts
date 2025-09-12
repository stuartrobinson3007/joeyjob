/**
 * Booking Employee Selection
 * 
 * This function is used during booking submission to:
 * 1. Determine which employees are available for the selected time slot
 * 2. Apply priority logic to select the best employee for the job
 * 3. Return employee info for Simpro job creation
 * 
 * Uses shared availability utilities - minimal additional API calls
 */

import { getSimproApiForUser } from './simpro.server'
import { 
    fetchEmployeesInBulk, 
    fetchSchedulesInBulk, 
    getAvailableEmployeesForTimeSlot,
    type ServiceSettings,
    type AvailableEmployee
} from './availability-utils.server'

export interface BookingEmployeeSelection {
    selectedEmployee: {
        employeeId: number
        employeeName: string
        isDefault: boolean
    }
    availableEmployees: AvailableEmployee[]
    totalEmployeesChecked: number
}

/**
 * Select the best available employee for a booking
 * 
 * Priority order:
 * 1. Default employee (if available)
 * 2. First available employee by ID
 * 
 * @param assignedEmployeeIds - Employee IDs assigned to this service
 * @param date - Booking date
 * @param startTime - Booking start time (e.g., "9:00am") 
 * @param serviceSettings - Service duration, buffer time, etc.
 * @param organizationId - Organization ID
 * @param userId - User ID for Simpro API access
 * @param employeePriorities - Optional priority info (default employee, etc.)
 * @returns Selected employee and availability info, or null if none available
 */
export async function selectEmployeeForBooking(
    assignedEmployeeIds: number[],
    date: Date,
    startTime: string,
    serviceSettings: ServiceSettings,
    organizationId: string,
    userId: string,
    employeePriorities?: Map<number, { isDefault: boolean }>
): Promise<BookingEmployeeSelection | null> {
    
    
    try {
        const simproApi = await getSimproApiForUser(userId)
        
        // STEP 1: Fetch employee details (reuse shared logic)
        const employeeDataMap = await fetchEmployeesInBulk(simproApi, assignedEmployeeIds)
        
        if (employeeDataMap.size === 0) {
            return null
        }
        
        // STEP 2: Fetch schedules for the booking date only (minimal API call)
        const bookingDateStr = date.toISOString().split('T')[0]
        const schedules = await fetchSchedulesInBulk(
            simproApi, 
            bookingDateStr, 
            bookingDateStr, // Same date for start and end
            assignedEmployeeIds
        )
        
        
        // STEP 3: Check which employees are available for this specific time slot
        const availableEmployees = getAvailableEmployeesForTimeSlot(
            employeeDataMap,
            schedules,
            date,
            startTime,
            serviceSettings,
            employeePriorities
        )
        
        
        if (availableEmployees.length === 0) {
            return {
                selectedEmployee: null as any,
                availableEmployees: [],
                totalEmployeesChecked: assignedEmployeeIds.length
            } as any
        }
        
        // STEP 4: Apply priority selection logic
        // The getAvailableEmployeesForTimeSlot already sorts by priority (default first)
        const selectedEmployee = availableEmployees[0]
        
        
        return {
            selectedEmployee,
            availableEmployees,
            totalEmployeesChecked: assignedEmployeeIds.length
        }
        
    } catch (error) {
        return null
    }
}

/**
 * Quick availability check for a specific time slot
 * Used for real-time validation before booking submission
 * 
 * @param assignedEmployeeIds - Employee IDs assigned to this service  
 * @param date - Check date
 * @param startTime - Check time (e.g., "9:00am")
 * @param serviceSettings - Service settings
 * @param organizationId - Organization ID
 * @param userId - User ID for Simpro API access
 * @returns True if at least one employee is available
 */
export async function isTimeSlotAvailable(
    assignedEmployeeIds: number[],
    date: Date,
    startTime: string,
    serviceSettings: ServiceSettings,
    organizationId: string,
    userId: string
): Promise<boolean> {
    
    try {
        const selection = await selectEmployeeForBooking(
            assignedEmployeeIds,
            date,
            startTime,
            serviceSettings,
            organizationId,
            userId
        )
        
        return selection !== null && selection.availableEmployees.length > 0
        
    } catch (error) {
        return false // Fail closed - assume not available on error
    }
}

/**
 * Get all available employees for a time slot (without selecting one)
 * Used when you need the full list of available employees
 */
export async function getAvailableEmployeesForBooking(
    assignedEmployeeIds: number[],
    date: Date,
    startTime: string,
    serviceSettings: ServiceSettings,
    organizationId: string,
    userId: string,
    employeePriorities?: Map<number, { isDefault: boolean }>
): Promise<AvailableEmployee[]> {
    
    try {
        const selection = await selectEmployeeForBooking(
            assignedEmployeeIds,
            date,
            startTime,
            serviceSettings,
            organizationId,
            userId,
            employeePriorities
        )
        
        return selection?.availableEmployees || []
        
    } catch (error) {
        return []
    }
}