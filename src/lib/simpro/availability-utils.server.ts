/**
 * Shared Availability Utilities
 * 
 * These utilities provide the core availability logic that can be used by:
 * - Calendar generation (bulk processing for entire month)
 * - Booking submission (single time slot employee selection)
 * - Employee availability checking (form editor, etc.)
 * 
 * Key principle: Same logic, different usage patterns, minimal API calls
 */

// Shared Types (based on real Simpro API responses)
export interface SimproEmployee {
    ID: number
    Name: string
    Availability: Array<{
        StartDate: string  // "Monday", "Tuesday", etc.
        StartTime: string  // "09:00"
        EndDate: string    // Same as StartDate
        EndTime: string    // "17:00"
    }>
}

export interface SimproSchedule {
    ID: number
    Type: string
    Reference: string
    TotalHours: number
    Staff: {
        ID: number
        Name: string
        Type: string
        TypeId: number
    }
    Date: string  // "2025-09-12"
    Blocks: Array<{
        Hrs: number
        StartTime: string     // "10:30"
        EndTime: string      // "11:00"
        ISO8601StartTime: string
        ISO8601EndTime: string
        ScheduleRate: {
            ID: number
            Name: string
        }
    }>
}

export interface EmployeeAvailabilityData {
    employeeId: number
    employeeName: string
    workingDays: Map<string, Array<{ startTime: string; endTime: string }>> // dayName -> array of time blocks
}

export interface ServiceSettings {
    duration: number      // minutes
    interval: number      // minutes  
    bufferTime: number   // minutes
    minimumNotice: number // hours
}

export interface AvailableEmployee {
    employeeId: number
    employeeName: string
    isDefault: boolean
}

/**
 * Fetch all employee details in bulk and cache their working hours
 * This is the primary API call for employee data - used by both calendar and booking
 */
export async function fetchEmployeesInBulk(
    simproApi: any,
    employeeIds: number[]
): Promise<Map<number, EmployeeAvailabilityData>> {
    
    const employeeMap = new Map<number, EmployeeAvailabilityData>()
    
    // Fetch all employee details concurrently (1 API call per employee, but concurrent)
    const employeePromises = employeeIds.map(async (employeeId) => {
        try {
            const employee = await simproApi.getEmployeeDetails(employeeId) as SimproEmployee
            
            // Build working days map from availability data
            const workingDays = new Map<string, Array<{ startTime: string; endTime: string }>>()
            
            if (employee.Availability && Array.isArray(employee.Availability)) {
                console.log(`🕐 [EMPLOYEE ${employeeId}] Raw availability data from Simpro:`, employee.Availability)
                employee.Availability.forEach(avail => {
                    console.log(`  ${avail.StartDate}: ${avail.StartTime} - ${avail.EndTime}`)
                    
                    // Add to existing blocks for this day (don't overwrite)
                    const existingBlocks = workingDays.get(avail.StartDate) || []
                    workingDays.set(avail.StartDate, [
                        ...existingBlocks,
                        { startTime: avail.StartTime, endTime: avail.EndTime }
                    ])
                })
            } else {
                console.log(`⚠️ [EMPLOYEE ${employeeId}] No availability data found`)
            }
            
            return {
                employeeId: employee.ID,
                employeeName: employee.Name,
                workingDays
            } as EmployeeAvailabilityData
            
        } catch (error) {
            console.warn(`⚠️ Could not fetch details for employee ${employeeId}:`, error)
            return null
        }
    })
    
    const results = await Promise.all(employeePromises)
    
    results.forEach(result => {
        if (result) {
            employeeMap.set(result.employeeId, result)
        }
    })
    
    console.log(`📋 [AVAILABILITY UTILS] Fetched ${employeeMap.size}/${employeeIds.length} employee details`)
    return employeeMap
}

/**
 * Fetch schedules for a date range in bulk
 * This is the primary API call for schedule data - used by both calendar and booking
 */
export async function fetchSchedulesInBulk(
    simproApi: any,
    startDate: string,
    endDate: string,
    employeeIds?: number[]
): Promise<SimproSchedule[]> {
    
    try {
        const allSchedules = await simproApi.getSchedules({ startDate, endDate }) as SimproSchedule[]
        
        // Filter for relevant employees if specified
        const relevantSchedules = Array.isArray(allSchedules) 
            ? allSchedules.filter(schedule => {
                if (!employeeIds) return true
                const staffId = schedule.Staff?.ID || (typeof schedule.Staff === 'number' ? schedule.Staff : 0)
                return employeeIds.includes(staffId)
              })
            : []
            
        console.log(`📅 [AVAILABILITY UTILS] Fetched ${relevantSchedules.length} schedules for ${startDate} to ${endDate}`)
        return relevantSchedules
        
    } catch (error) {
        console.warn(`⚠️ Could not fetch schedules for ${startDate} to ${endDate}:`, error)
        return []
    }
}

/**
 * Check if a specific employee is available for a specific time slot
 * Uses cached employee and schedule data - no additional API calls
 */
export function isEmployeeAvailableForTimeSlot(
    employeeData: EmployeeAvailabilityData,
    schedules: SimproSchedule[],
    date: Date,
    startTime: string, // "9:00am" format
    serviceSettings: ServiceSettings
): boolean {
    
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()]
    const dateKey = date.toISOString().split('T')[0]
    
    // Check if employee has any work blocks on this day
    const workingBlocks = employeeData.workingDays.get(dayOfWeek)
    if (!workingBlocks || workingBlocks.length === 0) {
        return false // Employee doesn't work this day
    }
    
    // Convert requested time to 24h format for calculations
    const startTime24h = convertTo24Hour(startTime)
    const startMinutes = timeToMinutes(startTime24h)
    const endMinutes = startMinutes + serviceSettings.duration
    
    // Check if requested time falls within ANY of the working blocks
    const fallsWithinWorkingHours = workingBlocks.some(workingHours => {
        const workStart = timeToMinutes(workingHours.startTime)
        const workEnd = timeToMinutes(workingHours.endTime)
        return startMinutes >= workStart && endMinutes <= workEnd
    })
    
    if (!fallsWithinWorkingHours) {
        return false // Outside all working hour blocks
    }
    
    // Check minimum notice requirement
    const slotDateTime = new Date(date)
    slotDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    const hoursUntilSlot = (slotDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilSlot < serviceSettings.minimumNotice) {
        return false // Not enough notice
    }
    
    // Check for booking conflicts
    const employeeSchedules = schedules.filter(s => 
        s.Date === dateKey && (s.Staff?.ID || (typeof s.Staff === 'number' ? s.Staff : 0)) === employeeData.employeeId
    )
    
    // Check if requested time conflicts with existing bookings
    const hasConflict = employeeSchedules.some(schedule => {
        return schedule.Blocks?.some(block => {
            const blockStart = timeToMinutes(block.StartTime) - serviceSettings.bufferTime
            const blockEnd = timeToMinutes(block.EndTime) + serviceSettings.bufferTime
            return startMinutes < blockEnd && endMinutes > blockStart
        })
    })
    
    return !hasConflict
}

/**
 * Get all available employees for a specific time slot
 * Uses cached data - no additional API calls
 */
export function getAvailableEmployeesForTimeSlot(
    employeeDataMap: Map<number, EmployeeAvailabilityData>,
    schedules: SimproSchedule[],
    date: Date,
    startTime: string, // "9:00am" format  
    serviceSettings: ServiceSettings,
    employeePriorities?: Map<number, { isDefault: boolean }> // for priority ordering
): AvailableEmployee[] {
    
    const availableEmployees: AvailableEmployee[] = []
    
    for (const [employeeId, employeeData] of employeeDataMap) {
        const isAvailable = isEmployeeAvailableForTimeSlot(
            employeeData,
            schedules,
            date,
            startTime,
            serviceSettings
        )
        
        if (isAvailable) {
            availableEmployees.push({
                employeeId: employeeData.employeeId,
                employeeName: employeeData.employeeName,
                isDefault: employeePriorities?.get(employeeId)?.isDefault || false
            })
        }
    }
    
    // Sort by priority: default employees first, then by employee ID
    availableEmployees.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1
        if (!a.isDefault && b.isDefault) return 1
        return a.employeeId - b.employeeId
    })
    
    return availableEmployees
}

/**
 * Calculate available time slots for all employees for a specific date
 * Used by calendar generation - processes one day at a time
 */
export function calculateAvailableSlotsForDate(
    employeeDataMap: Map<number, EmployeeAvailabilityData>,
    schedules: SimproSchedule[],
    date: Date,
    serviceSettings: ServiceSettings
): string[] {
    
    const allAvailableSlots = new Map<string, number[]>() // slot time -> employee IDs
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()]
    const dateKey = date.toISOString().split('T')[0]
    
    // Process each employee
    for (const [employeeId, employeeData] of employeeDataMap) {
        const workingBlocks = employeeData.workingDays.get(dayOfWeek)
        if (!workingBlocks || workingBlocks.length === 0) {
            console.log(`  Employee ${employeeId}: Not scheduled to work on ${dayOfWeek}`)
            continue // Employee doesn't work this day
        }
        
        console.log(`  Employee ${employeeId}: Has ${workingBlocks.length} work block(s) on ${dayOfWeek}:`, 
            workingBlocks.map(block => `${block.startTime}-${block.endTime}`).join(', '))
        
        // Get employee's existing bookings for this date
        const employeeSchedules = schedules.filter(s => 
            s.Date === dateKey && (s.Staff?.ID || (typeof s.Staff === 'number' ? s.Staff : 0)) === employeeId
        )
        
        // Calculate available slots for each work block and combine them
        const allEmployeeSlots: string[] = []
        
        workingBlocks.forEach((workingHours, blockIndex) => {
            console.log(`    Processing block ${blockIndex + 1}: ${workingHours.startTime}-${workingHours.endTime}`)
            
            const blockSlots = calculateAvailableSlotsForEmployee(
                workingHours,
                employeeSchedules,
                serviceSettings,
                date
            )
            
            console.log(`    Block ${blockIndex + 1} generated ${blockSlots.length} slots`)
            allEmployeeSlots.push(...blockSlots)
        })
        
        // Remove duplicates and add to combined availability
        const uniqueEmployeeSlots = [...new Set(allEmployeeSlots)]
        console.log(`  Employee ${employeeId}: Total ${uniqueEmployeeSlots.length} unique slots from all blocks`)
        
        uniqueEmployeeSlots.forEach(slot => {
            if (!allAvailableSlots.has(slot)) {
                allAvailableSlots.set(slot, [])
            }
            allAvailableSlots.get(slot)!.push(employeeId)
        })
    }
    
    // Return sorted unique time slots (a slot is available if at least one employee can work it)
    // Sort chronologically, not alphabetically
    const finalSlots = Array.from(allAvailableSlots.keys()).sort((a, b) => {
        const aMinutes = timeStringToMinutes(a)
        const bMinutes = timeStringToMinutes(b)
        return aMinutes - bMinutes
    })
    console.log(`📅 [${dateKey}] Generated ${finalSlots.length} time slots:`, finalSlots.join(', '))
    return finalSlots
}

/**
 * Calculate available time slots for a single employee on a specific date
 */
function calculateAvailableSlotsForEmployee(
    workingHours: { startTime: string; endTime: string },
    employeeSchedules: SimproSchedule[],
    serviceSettings: ServiceSettings,
    checkDate: Date
): string[] {
    
    const slots: string[] = []
    
    // Convert working hours to minutes
    const workStart = timeToMinutes(workingHours.startTime)
    const workEnd = timeToMinutes(workingHours.endTime)
    
    console.log(`    🔢 [TIME CONVERSION] Working hours: ${workingHours.startTime} - ${workingHours.endTime}`)
    console.log(`    🔢 [TIME CONVERSION] Converted to minutes: ${workStart} - ${workEnd} (${Math.floor(workStart/60)}:${(workStart%60).toString().padStart(2,'0')} - ${Math.floor(workEnd/60)}:${(workEnd%60).toString().padStart(2,'0')})`)
    
    // Get busy periods from existing schedules
    const busyPeriods = employeeSchedules
        .flatMap(schedule => schedule.Blocks || [])
        .map(block => ({
            start: timeToMinutes(block.StartTime) - serviceSettings.bufferTime,
            end: timeToMinutes(block.EndTime) + serviceSettings.bufferTime
        }))
        .sort((a, b) => a.start - b.start)
    
    // Merge overlapping busy periods
    const mergedBusyPeriods = mergePeriods(busyPeriods)
    
    // Generate available slots
    let currentTime = workStart
    
    while (currentTime + serviceSettings.duration <= workEnd) {
        const slotEnd = currentTime + serviceSettings.duration
        
        // Check if slot overlaps with busy periods
        const isBlocked = mergedBusyPeriods.some(busy => 
            currentTime < busy.end && slotEnd > busy.start
        )
        
        if (!isBlocked) {
            // Check minimum notice requirement
            const slotDateTime = new Date(checkDate)
            slotDateTime.setHours(Math.floor(currentTime / 60), currentTime % 60, 0, 0)
            
            const hoursUntilSlot = (slotDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
            
            if (hoursUntilSlot >= serviceSettings.minimumNotice) {
                const timeSlot = minutesToTime12h(currentTime)
                if (slots.length < 5) { // Log first 5 slots for debugging
                    console.log(`    🕐 [SLOT GENERATION] Time ${currentTime} minutes = ${Math.floor(currentTime/60)}:${(currentTime%60).toString().padStart(2,'0')} = ${timeSlot}`)
                }
                slots.push(timeSlot)
            }
        }
        
        currentTime += serviceSettings.interval
    }
    
    return slots
}

// Helper functions
function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return (hours * 60) + minutes
}

function minutesToTime12h(minutes: number): string {
    let hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const ampm = hours >= 12 ? 'pm' : 'am'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${hours.toString()}:${mins.toString().padStart(2, '0')}${ampm}`
}

function timeStringToMinutes(timeStr: string): number {
    // Convert 12-hour format back to minutes for proper sorting
    const match = timeStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/)
    if (!match) return 0
    
    let [_, hours, minutes, period] = match
    let hour = parseInt(hours)
    const mins = parseInt(minutes)
    
    // Convert to 24-hour format
    if (period === 'pm' && hour !== 12) {
        hour += 12
    } else if (period === 'am' && hour === 12) {
        hour = 0
    }
    
    return (hour * 60) + mins
}

function convertTo24Hour(time12h: string): string {
    const [time, period] = time12h.toLowerCase().split(/([ap]m)/)
    const [hours, minutes] = time.split(':').map(Number)
    
    let hours24 = hours
    if (period === 'pm' && hours !== 12) {
        hours24 += 12
    } else if (period === 'am' && hours === 12) {
        hours24 = 0
    }
    
    return `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function mergePeriods(periods: { start: number; end: number }[]): { start: number; end: number }[] {
    if (periods.length === 0) return []
    
    const sorted = [...periods].sort((a, b) => a.start - b.start)
    const merged: { start: number; end: number }[] = [sorted[0]]
    
    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1]
        const current = sorted[i]
        
        if (current.start <= last.end) {
            // Overlapping periods, merge them
            last.end = Math.max(last.end, current.end)
        } else {
            // Non-overlapping, add as new period
            merged.push(current)
        }
    }
    
    return merged
}