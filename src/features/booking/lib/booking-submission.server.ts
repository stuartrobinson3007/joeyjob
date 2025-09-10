import { BookingSubmitData } from '@/features/booking/components/form-editor/booking-flow'
import { createSimproBookingForUser } from '@/lib/simpro/simpro.server'
import { assignEmployeeToBooking, updateBookingSimproStatus } from '@/lib/simpro/employees.server'
import { db } from '@/lib/db/db'
import { bookings, services, organizationEmployees } from '@/database/schema'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

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
        employee: bookingData.employee?.id,
        date: bookingData.date,
        time: bookingData.time
    })

    // Step 1: Validate that the service exists and belongs to the organization
    const service = await db
        .select()
        .from(services)
        .where(
            and(
                eq(services.id, bookingData.service.id),
                eq(services.organizationId, organizationId)
            )
        )
        .limit(1)

    if (!service.length) {
        throw new Error('Service not found or access denied')
    }

    const serviceRecord = service[0]

    // Step 2: Validate employee if selected
    let employeeRecord = null
    if (bookingData.employee) {
        const orgEmployee = await db
            .select()
            .from(organizationEmployees)
            .where(
                and(
                    eq(organizationEmployees.id, bookingData.employee.id),
                    eq(organizationEmployees.organizationId, organizationId),
                    eq(organizationEmployees.isActive, true)
                )
            )
            .limit(1)

        if (!orgEmployee.length) {
            throw new Error('Selected employee not found or not available')
        }

        employeeRecord = orgEmployee[0]
    }

    // Step 3: Create booking in JoeyJob database
    const bookingId = nanoid()
    const confirmationCode = `JJ${Date.now().toString().slice(-8)}`

    // Extract customer info from form data
    const customerName = `${bookingData.formData.contact?.firstName || ''} ${bookingData.formData.contact?.lastName || ''}`.trim()
    const customerEmail = bookingData.formData.contact?.email || ''
    const customerPhone = bookingData.formData.contact?.phone || ''

    const booking = await db
        .insert(bookings)
        .values({
            id: bookingId,
            organizationId,
            serviceId: serviceRecord.id,
            customerEmail,
            customerName,
            customerPhone,
            bookingDate: new Date(bookingData.date),
            startTime: bookingData.time,
            endTime: calculateEndTime(bookingData.time, serviceRecord.duration),
            duration: serviceRecord.duration,
            price: serviceRecord.price,
            status: 'pending',
            formData: bookingData.formData,
            confirmationCode,
            createdBy: null, // Customer booking (not created by a user)
        })
        .returning()

    const createdBooking = booking[0]

    try {
        // Step 4: Assign employee to booking (if selected)
        if (employeeRecord) {
            await assignEmployeeToBooking(bookingId, employeeRecord.id)
        }

        // Step 5: Create booking in Simpro (if user has Simpro integration and employee is selected)
        let simproData = null
        let hasSimproIntegration = true
        
        try {
            if (employeeRecord) {
                simproData = await createSimproBookingForUser(userId, {
                    customer: {
                        givenName: bookingData.formData.contact?.firstName || customerName.split(' ')[0] || 'Customer',
                        familyName: bookingData.formData.contact?.lastName || customerName.split(' ')[1] || '',
                        email: customerEmail,
                        phone: customerPhone,
                        address: {
                            line1: bookingData.formData.address?.street || '123 Main St',
                            city: bookingData.formData.address?.city || 'Unknown City',
                            state: bookingData.formData.address?.state || 'Unknown State', 
                            postalCode: bookingData.formData.address?.zip || '00000',
                            country: 'AUS'
                        }
                    },
                    job: {
                        type: 'Service',
                        name: serviceRecord.name,
                        description: serviceRecord.description || `${serviceRecord.name} booking via JoeyJob`
                    },
                    schedule: {
                        employeeId: employeeRecord.simproEmployeeId,
                        blocks: [{
                            startTime: bookingData.time,
                            endTime: calculateEndTime(bookingData.time, serviceRecord.duration),
                            date: bookingData.date.split('T')[0] // Get just the date part
                        }]
                    }
                })

                console.log('Simpro booking created successfully:', simproData)

                // Update booking with Simpro references
                if (employeeRecord) {
                    await updateBookingSimproStatus(
                        bookingId,
                        'scheduled',
                        {
                            jobId: simproData.job.ID,
                            customerId: simproData.customer.ID,
                            scheduleId: simproData.schedule.ID,
                            siteId: simproData.customer.Sites?.[0]?.ID
                        }
                    )
                }
            } else {
                // No employee selected - just log that the booking was created locally
                console.log('Booking created locally only (no employee selected)')
            }
        } catch (simproError) {
            console.error('Simpro integration failed:', simproError)
            hasSimproIntegration = false
            
            // Check if this is a "no Simpro account" error vs other errors
            const errorMessage = simproError instanceof Error ? simproError.message : 'Simpro sync failed'
            const isNoSimproAccount = errorMessage.includes('No Simpro account') || 
                                      errorMessage.includes('Missing Simpro tokens') ||
                                      errorMessage.includes('Missing Simpro build configuration')
            
            // Update booking status to indicate Simpro sync failed (only if employee was selected)
            if (employeeRecord) {
                await updateBookingSimproStatus(
                    bookingId,
                    'pending',
                    undefined,
                    isNoSimproAccount ? 'No Simpro integration configured' : errorMessage
                )
            }

            // Don't throw the error - the booking was created successfully in JoeyJob
            // We'll handle the Simpro sync failure gracefully
            console.log(`Booking created locally${isNoSimproAccount ? ' (no Simpro integration)' : ' (Simpro sync failed)'}`)
        }

        return {
            success: true,
            booking: createdBooking,
            simpro: simproData,
            confirmationCode,
            hasSimproIntegration,
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
 * Calculate end time based on start time and duration in minutes
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number)
    const startDate = new Date()
    startDate.setHours(hours, minutes, 0, 0)
    
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000)
    
    return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
}