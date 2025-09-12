import { BookingSubmitData } from '@/features/booking/components/form-editor/booking-flow'
import { createSimproBookingForUser } from '@/lib/simpro/simpro.server'
import { assignEmployeeToBooking, updateBookingSimproStatus } from '@/lib/simpro/employees.server'
import { db } from '@/lib/db/db'
import { bookings, services, organizationEmployees, organization, bookingForms, bookingEmployees } from '@/database/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { combineDateAndTime, formatInTimezone } from '@/taali/utils/date'
import { addMinutes, format } from 'date-fns'
import { selectEmployeeForBooking } from '@/lib/simpro/booking-employee-selection.server'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'

/**
 * Submit a booking and create it in both JoeyJob and Simpro
 */
export async function submitBookingWithSimproIntegration({
    organizationId,
    userId,
    bookingData
}: {
    organizationId: string
    userId: string
    bookingData: BookingSubmitData
}) {
    console.log('Starting booking submission with Simpro integration:', {
        organizationId,
        userId,
        service: bookingData.service.id,
        date: bookingData.date,
        time: bookingData.time
    })

    // Get organization with timezone
    const org = await db
        .select()
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1)

    if (!org.length) {
        throw new AppError(
            ERROR_CODES.BIZ_NOT_FOUND,
            404,
            { organizationId },
            'Organization not found'
        )
    }

    const orgRecord = org[0]

    // Get service details from form config
    const form = await db
        .select()
        .from(bookingForms)
        .where(
            and(
                eq(bookingForms.organizationId, organizationId),
                eq(bookingForms.isActive, true),
                isNull(bookingForms.deletedAt)
            )
        )
        .limit(1)

    if (!form.length) {
        throw new AppError(
            ERROR_CODES.BIZ_NOT_FOUND,
            404,
            { formId: bookingData.service },
            'No active booking form found'
        )
    }

    const formConfig = form[0].formConfig as any
    const serviceNode = findServiceInTree(formConfig?.serviceTree, bookingData.service.id)

    if (!serviceNode) {
        throw new AppError(
            ERROR_CODES.BIZ_NOT_FOUND,
            404,
            { serviceId: bookingData.service },
            'Service not found in form configuration'
        )
    }

    // Convert booking time to UTC using organization timezone
    const bookingStartAt = combineDateAndTime(
        bookingData.date,
        bookingData.time,
        orgRecord.timezone
    )
    const bookingEndAt = addMinutes(bookingStartAt, serviceNode.duration)

    console.log('Converted booking times:', {
        originalDate: bookingData.date,
        originalTime: bookingData.time,
        timezone: orgRecord.timezone,
        startAtUTC: bookingStartAt.toISOString(),
        endAtUTC: bookingEndAt.toISOString()
    })

    // Extract customer info from form data
    // Form fields use hyphenated IDs: 'first-name', 'last-name', etc.
    const customer = {
        firstName: bookingData.formData['first-name'] || '',
        lastName: bookingData.formData['last-name'] || '',
        name: `${bookingData.formData['first-name'] || ''} ${bookingData.formData['last-name'] || ''}`.trim() || 'Customer',
        email: bookingData.formData['email'] || '',
        phone: bookingData.formData['phone'] || ''
    }

    // Extract address data (make optional for Simpro) 
    // Check if address fields exist in form data (using hyphenated IDs)
    const hasAddress = bookingData.formData['street'] || bookingData.formData['city'] || bookingData.formData['state']
    const address = hasAddress ? {
        line1: bookingData.formData['street'] || 'No Address Provided',
        city: bookingData.formData['city'] || 'Unknown',
        state: bookingData.formData['state'] || 'Unknown', 
        postalCode: bookingData.formData['zip'] || '00000',
        country: bookingData.formData['country'] || 'AUS'
    } : null

    const bookingId = nanoid()
    const confirmationCode = `JJ${Date.now().toString().slice(-8)}`

    // Create booking in database with proper timestamps
    const booking = await db
        .insert(bookings)
        .values({
            id: bookingId,
            organizationId,
            serviceId: bookingData.service.id,
            formId: form[0].id,
            customerEmail: customer.email,
            customerName: customer.name,
            customerPhone: customer.phone,
            bookingStartAt,
            bookingEndAt,
            duration: serviceNode.duration,
            price: serviceNode.price || '0',
            status: 'pending',
            formData: bookingData.formData,
            confirmationCode,
            createdBy: null, // Customer booking (not created by a user)
        })
        .returning()

    const createdBooking = booking[0]

    // Get all assigned employees for smart selection
    const assignedEmployeeIds = serviceNode.assignedEmployeeIds || []
    const defaultEmployeeId = serviceNode.defaultEmployeeId
    
    console.log('Employee assignment:', {
        assignedEmployeeIds,
        defaultEmployeeId: defaultEmployeeId || 'none'
    })

    // Get all assigned employee records
    const assignedEmployees = await db
        .select()
        .from(organizationEmployees)
        .where(
            and(
                inArray(organizationEmployees.id, assignedEmployeeIds),
                eq(organizationEmployees.organizationId, organizationId),
                eq(organizationEmployees.isActive, true)
            )
        )

    if (assignedEmployees.length === 0) {
        throw new AppError(
            ERROR_CODES.BIZ_INVALID_STATE,
            400,
            { serviceId: bookingData.service },
            'No active employees assigned to this service'
        )
    }

    console.log('Found assigned employees:', assignedEmployees.map(emp => ({
        id: emp.id,
        name: emp.simproEmployeeName,
        simproId: emp.simproEmployeeId
    })))

    // Convert booking time to proper format for availability check
    const bookingDate = new Date(bookingData.date)
    
    // Find which employees are actually available for this time slot using optimized selection
    const employeeSelection = await selectEmployeeForBooking(
        assignedEmployees.map(emp => emp.simproEmployeeId),
        bookingDate,
        bookingData.time,
        {
            duration: serviceNode.duration,
            interval: serviceNode.interval || 30,
            bufferTime: serviceNode.bufferTime || 15,
            minimumNotice: serviceNode.minimumNotice || 0
        },
        organizationId,
        userId,
        new Map(assignedEmployees.map(emp => [
            emp.simproEmployeeId, 
            { isDefault: emp.id === defaultEmployeeId }
        ]))
    )

    if (!employeeSelection || employeeSelection.availableEmployees.length === 0) {
        throw new AppError(
            ERROR_CODES.BIZ_INVALID_STATE,
            400,
            { timeSlot: `${bookingData.date} at ${bookingData.time}` },
            'No employees available for the selected time slot. Please choose a different time.'
        )
    }

    console.log(`Found ${employeeSelection.availableEmployees.length} available employees for ${bookingData.date} at ${bookingData.time}`)

    // Get the selected employee data from our database
    const selectedEmployee = assignedEmployees.find(emp => 
        emp.simproEmployeeId === employeeSelection.selectedEmployee.employeeId
    )
    
    if (!selectedEmployee) {
        throw new AppError(
            ERROR_CODES.BIZ_INVALID_STATE,
            500,
            { employeeId: employeeSelection.selectedEmployee.employeeId },
            'Could not assign an employee for this booking'
        )
    }

    console.log('Selected employee for booking:', {
        id: selectedEmployee.id,
        name: selectedEmployee.simproEmployeeName,
        simproId: selectedEmployee.simproEmployeeId,
        isDefault: selectedEmployee.isDefault
    })

    try {
        // Get the full employee record for Simpro integration
        const employeeRecord = assignedEmployees.find(emp => emp.id === selectedEmployee.id)
        if (!employeeRecord) {
            throw new AppError(
                ERROR_CODES.BIZ_INVALID_STATE,
                500,
                { employeeId: selectedEmployee.id },
                'Selected employee record not found'
            )
        }

        // Create Simpro booking if employee is assigned
        let simproData = null
        if (employeeRecord) {
            try {
                simproData = await createSimproBookingForUser(userId, {
                    customer: {
                        givenName: customer.firstName || 'Customer',
                        familyName: customer.lastName || 'Customer', // Simpro requires non-empty FamilyName
                        email: customer.email,
                        phone: customer.phone,
                        address: address || {
                            line1: 'No Address Provided',
                            city: 'Unknown',
                            state: 'Unknown',
                            postalCode: '00000',
                            country: 'AUS'
                        }
                    },
                    job: {
                        type: 'Service',
                        name: serviceNode.label,
                        description: serviceNode.description || serviceNode.label
                    },
                    schedule: {
                        employeeId: employeeRecord.simproEmployeeId,
                        blocks: [{
                            date: format(bookingStartAt, 'yyyy-MM-dd'),
                            startTime: format(bookingStartAt, 'HH:mm'),
                            endTime: format(bookingEndAt, 'HH:mm')
                        }]
                    }
                })

                console.log('Simpro booking created successfully:', simproData)

                // Create booking-employee assignment with Simpro IDs
                await db.insert(bookingEmployees).values({
                    id: nanoid(),
                    bookingId,
                    organizationEmployeeId: employeeRecord.id,
                    simproJobId: simproData.job.ID,
                    simproCustomerId: simproData.customer.ID,
                    simproScheduleId: simproData.schedule.ID,
                    simproSiteId: simproData.customer.Sites?.[0]?.ID,
                    simproStatus: 'scheduled'
                })

                // Update booking status to confirmed
                await db
                    .update(bookings)
                    .set({ status: 'confirmed' })
                    .where(eq(bookings.id, bookingId))
            } catch (simproError) {
                console.error('Simpro integration failed:', simproError)
                
                const errorMessage = simproError instanceof Error ? simproError.message : 'Unknown error'
                
                // Categorize errors for better handling
                if (errorMessage.includes('No Simpro account') || 
                    errorMessage.includes('Missing Simpro tokens') ||
                    errorMessage.includes('Missing Simpro build configuration')) {
                    console.log('Organization has no Simpro integration')
                    
                    throw new AppError(
                        ERROR_CODES.SYS_CONFIG_ERROR,
                        500,
                        { simproError: errorMessage },
                        'Simpro integration is not configured for this organization. Please contact support.'
                    )
                } else if (errorMessage.includes('422') || errorMessage.includes('Unprocessable Entity')) {
                    // Handle Simpro API validation errors
                    throw new AppError(
                        ERROR_CODES.BIZ_INVALID_STATE,
                        400,
                        { simproError: errorMessage },
                        'Unable to create booking in scheduling system. Please try again or contact support.'
                    )
                } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
                    // Handle Simpro authentication errors
                    throw new AppError(
                        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
                        401,
                        { simproError: errorMessage },
                        'Scheduling system authentication failed. Please contact support.'
                    )
                } else {
                    // Generic Simpro error
                    throw new AppError(
                        ERROR_CODES.SYS_SERVER_ERROR,
                        500,
                        { simproError: errorMessage },
                        'Failed to integrate with scheduling system. Please try again.'
                    )
                }
            }
        } else {
            console.log('No employees assigned to service - booking created without Simpro sync')
        }

        return {
            success: true,
            booking: createdBooking,
            simpro: simproData,
            confirmationCode,
            employeeAssigned: !!employeeRecord
        }

    } catch (error) {
        console.error('Booking processing failed:', error)
        
        // Clean up: delete the created booking if Simpro processing fails critically
        await db
            .delete(bookings)
            .where(eq(bookings.id, bookingId))

        throw error
    }
}

/**
 * Helper function to find a service in the service tree structure
 */
function findServiceInTree(tree: any, serviceId: string): any {
    if (!tree) return null
    
    if (tree.id === serviceId && tree.type === 'service') {
        return tree
    }
    
    if (tree.children) {
        for (const child of tree.children) {
            const found = findServiceInTree(child, serviceId)
            if (found) return found
        }
    }
    
    return null
}