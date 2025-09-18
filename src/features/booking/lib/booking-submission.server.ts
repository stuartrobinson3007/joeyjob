import { BookingSubmitData } from '@/features/booking/components/form-editor/booking-flow'
import { createSimproBookingForOrganization } from '@/lib/simpro/simpro.server'
import { assignEmployeeToBooking, updateBookingSimproStatus } from '@/lib/simpro/employees.server'
import { db } from '@/lib/db/db'
import { bookings, organizationEmployees, bookingForms, bookingEmployees } from '@/database/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { addMinutes, format } from 'date-fns'
import { selectEmployeeForBooking } from '@/lib/simpro/booking-employee-selection.server'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import { combineDateAndTime } from '@/taali/utils/date'
import { toZonedTime } from 'date-fns-tz'
import { formatAddressOneLine } from '@/utils/maps'

// Helper functions for time conversion
function to24HourTime(time12h: string): string {
    const match = time12h.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
    if (!match) throw new Error(`Invalid time format: ${time12h}`)
    
    let [_, hours, minutes, period] = match
    let hour = parseInt(hours)
    
    if (period.toLowerCase() === 'pm' && hour !== 12) {
        hour += 12
    } else if (period.toLowerCase() === 'am' && hour === 12) {
        hour = 0
    }
    
    return `${hour.toString().padStart(2, '0')}:${minutes}`
}

function calculateEndTime(startTime12h: string, durationMinutes: number): string {
    const startTime24h = to24HourTime(startTime12h)
    const [hours, minutes] = startTime24h.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const endMinutes = startMinutes + durationMinutes
    
    const endHours = Math.floor(endMinutes / 60) % 24  // Handle day overflow
    const endMins = endMinutes % 60
    
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
}


// Function to format form responses as HTML for Simpro notes
function formatFormResponsesAsHTML(formData: any): string {
    const responses: string[] = []

    // Process all fields except contact info and address fields
    Object.entries(formData)
        .filter(([key]) => !['Contact Information', 'contact_info', 'Address'].includes(key))
        .forEach(([questionLabel, answer]) => {
            if (answer && answer !== '') {
                // Handle different answer types
                let formattedAnswer = answer
                if (Array.isArray(answer)) {
                    formattedAnswer = answer.join(', ')
                } else if (typeof answer === 'object') {
                    formattedAnswer = JSON.stringify(answer)
                }

                responses.push(`<li><strong>${questionLabel}:</strong> ${formattedAnswer}</li>`)
            }
        })

    if (responses.length === 0) {
        return ''
    }

    return `<h4>Customer Responses:</h4>\n<ul>\n${responses.join('\n')}\n</ul>`
}

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

    // Use timezone passed from frontend (no DB fetch needed)

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


    // Convert booking date/time to UTC using organization timezone
    const bookingStartAt = combineDateAndTime(
        bookingData.date,
        bookingData.time,
        bookingData.organizationTimezone
    )
    const bookingEndAt = addMinutes(bookingStartAt, serviceNode.duration)

    // Extract date in organization timezone for Simpro API
    // This ensures the date matches what the user intended in the org's timezone context
    const orgZonedTime = toZonedTime(bookingStartAt, bookingData.organizationTimezone)
    const dateOnly = format(orgZonedTime, 'yyyy-MM-dd')


    // Extract customer info from form data (handle both old and new format)
    const contactInfo = bookingData.formData['Contact Information'] || bookingData.formData.contact_info
    const customer = {
        firstName: contactInfo?.firstName || '',
        lastName: contactInfo?.lastName || '',
        name: `${contactInfo?.firstName || ''} ${contactInfo?.lastName || ''}`.trim() || 'Customer',
        email: contactInfo?.email || '',
        phone: contactInfo?.phone || ''
    }

    // Extract address data from form (now using question labels)
    const addressData = bookingData.formData['Address'] as any || null
    const address = addressData ? {
        line1: `${addressData.street || ''}${addressData.street2 ? ', ' + addressData.street2 : ''}`.trim() || 'No Address Provided',
        city: addressData.city || 'Unknown',
        state: addressData.state || 'Unknown', 
        postalCode: addressData.zip || addressData.postalCode || '00000',
        country: addressData.country || 'AUS'
    } : null
    

    const bookingId = nanoid()
    const confirmationCode = `JJ${Date.now().toString().slice(-8)}`

    // Transform form data to match schema structure
    const formResponses = {
        contactInfo: bookingData.formData['Contact Information'] || bookingData.formData.contact_info,
        address: bookingData.formData['Address'] || null,
        customQuestions: Object.entries(bookingData.formData)
            .filter(([key]) => !['Contact Information', 'contact_info', 'Address'].includes(key))
            .map(([questionText, answer]) => ({
                questionId: questionText, // Now using question text as ID since we transformed it
                questionText: questionText, // The key is now the question text
                questionType: 'text', // Could be determined from field name or form config
                answer,
                fieldName: questionText
            }))
    }

    // Create booking in database with proper timestamps
    const booking = await db
        .insert(bookings)
        .values({
            id: bookingId,
            organizationId,
            formId: form[0].id,
            // Service Information (denormalized)
            serviceName: serviceNode.label,
            serviceDescription: serviceNode.description,
            serviceDuration: serviceNode.duration,
            servicePrice: serviceNode.price?.toString() || '0',
            
            // Customer Information
            customerEmail: customer.email,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerCompany: bookingData.formData['company'] || null,
            customerAddress: addressData ? formatAddressOneLine(addressData) : null,
            
            // Scheduling (UTC timestamps)
            bookingStartAt,
            bookingEndAt,
            customerTimezone: bookingData.organizationTimezone,
            
            // Form Responses (structured)
            formResponses,
            
            // Status and metadata
            status: 'pending',
            confirmationCode,
            bookingSource: 'web',
            createdBy: null
        })
        .returning()

    const createdBooking = booking[0]

    // Get all assigned employees for smart selection
    const assignedEmployeeIds = serviceNode.assignedEmployeeIds || []
    const defaultEmployeeId = serviceNode.defaultEmployeeId
    

    // Get all assigned employee records
    const assignedEmployees = await db
        .select()
        .from(organizationEmployees)
        .where(
            and(
                inArray(organizationEmployees.id, assignedEmployeeIds),
                eq(organizationEmployees.organizationId, organizationId),
                eq(organizationEmployees.isEnabled, true)
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
                // Format form responses as HTML for job notes (separate from description)
                const formResponsesHTML = formatFormResponsesAsHTML(bookingData.formData)
                
                
                simproData = await createSimproBookingForOrganization(organizationId, {
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
                        description: serviceNode.description || serviceNode.label, // Service info only
                        notes: formResponsesHTML // Customer responses in notes with HTML
                    },
                    schedule: {
                        employeeId: employeeRecord.simproEmployeeId,
                        blocks: [{
                            date: dateOnly,  // Use the date as-is
                            startTime: to24HourTime(bookingData.time), // Convert user time to 24h format
                            endTime: calculateEndTime(bookingData.time, serviceNode.duration) // Calculate end time in 24h format
                        }]
                    }
                })

                // 🎆 SIMPRO JOB CREATED
                console.log('Simpro booking created successfully:', {
                    jobId: simproData.job.ID,
                    customerId: simproData.customer.ID,
                    scheduleId: simproData.schedule.ID,
                    employee: selectedEmployee.simproEmployeeName
                })

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