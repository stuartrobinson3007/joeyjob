import { createServerFileRoute } from '@tanstack/react-start/server'
import { BookingSubmitData } from '@/features/booking/components/form-editor/booking-flow'
import { submitBookingWithSimproIntegration } from '@/features/booking/lib/booking-submission.server'
import { db } from '@/lib/db/db'
import { member } from '@/database/schema'
import { eq, and, or } from 'drizzle-orm'

export const ServerRoute = createServerFileRoute('/api/bookings/submit').methods({
    POST: async ({ request }) => {
        try {
            const body = await request.json()
            const { organizationId, bookingData } = body as {
                organizationId: string
                bookingData: BookingSubmitData
            }

            if (!organizationId) {
                return Response.json({ error: 'Organization ID is required' }, { status: 400 })
            }

            if (!bookingData) {
                return Response.json({ error: 'Booking data is required' }, { status: 400 })
            }

            // Validate required booking data
            if (!bookingData.service || !bookingData.date || !bookingData.time || !bookingData.formData) {
                return Response.json({ 
                    error: 'Missing required booking data (service, date, time, or form data)' 
                }, { status: 400 })
            }

            // Find an organization owner or admin to use their Simpro credentials
            const orgMembers = await db
                .select({ userId: member.userId, role: member.role })
                .from(member)
                .where(
                    and(
                        eq(member.organizationId, organizationId),
                        or(
                            eq(member.role, 'owner'),
                            eq(member.role, 'admin')
                        )
                    )
                )
                .limit(1)

            if (!orgMembers.length) {
                return Response.json({ 
                    error: 'No organization admin found for Simpro integration' 
                }, { status: 400 })
            }

            const userId = orgMembers[0].userId

            const result = await submitBookingWithSimproIntegration({
                organizationId,
                userId, // This needs to be the organization admin/owner
                bookingData
            })

            return Response.json({
                success: true,
                bookingId: result.booking.id,
                confirmationCode: result.confirmationCode,
                message: 'Booking submitted successfully'
            })

        } catch (error) {
            console.error('Booking submission API error:', error)
            
            return Response.json({
                error: error instanceof Error ? error.message : 'Failed to submit booking',
                success: false
            }, { status: 500 })
        }
    }
})