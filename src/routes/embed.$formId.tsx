import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'

import { Card, CardContent, CardHeader } from '@/ui/card'
import BookingFlow, { BookingState, BookingSubmitData } from '@/features/booking/components/form-editor/booking-flow'

// Note: Server function will be called dynamically in the loader
// to avoid bundling server code into client

export const Route = createFileRoute('/embed/$formId')({
  head: () => ({
    meta: [
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  }),
  // Configure headers for iframe embedding
  headers: () => ({
    // Allow this page to be embedded in iframes from any origin
    // Remove X-Frame-Options entirely to allow embedding
    // (setting ALLOWALL is not a valid value)
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }),
  component: EmbedBookingPage,
  loader: async ({ params }) => {
    // This is a public route - no auth required for customers
    try {
      // Dynamically import and call the server function
      const { getBookingForm } = await import('@/features/booking/lib/forms.server')
      const formData = await getBookingForm({ data: { id: params.formId } })

      if (!formData || !formData.form.isActive) {
        throw new Error('Booking form not found or inactive')
      }

      return {
        form: formData.form,
        organization: formData.organization,
        service: formData.service, // Service info embedded in form
      }
    } catch (error) {
      throw new Error('Unable to load booking form')
    }
  },
  errorComponent: ({ error }) => (
    <div className="light min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-xl font-semibold text-center">Booking Not Available</h2>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">
            {error.message || 'This booking form is currently not available.'}
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact the business directly to schedule your appointment.
          </p>
        </CardContent>
      </Card>
    </div>
  ),
})

function EmbedBookingPage() {
  const { form, organization, service } = Route.useLoaderData()
  const containerRef = useRef<HTMLDivElement>(null)

  // Theme and styling from form config
  const theme = form.theme || 'light'
  const primaryColor = form.primaryColor || '#3B82F6'

  // Extract services and questions from form config
  const services = form.formConfig?.serviceTree?.children || []
  const baseQuestions = form.formConfig?.baseQuestions || []

  // BookingFlow state management
  const [bookingState, setBookingState] = useState<BookingState>({
    stage: 'selection',
    navigationPath: [],
    selectedService: null,
    selectedEmployee: null,
    selectedDate: null,
    selectedTime: null,
  })

  // Auto-resize functionality for iframe
  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development'
    const debugLog = (message: string, data?: any) => {
      if (isDev) {
        console.log(`[EmbedResize] ${message}`, data || '')
      }
    }

    let lastHeight = 0
    let resizeCount = 0
    let pollingCount = 0
    let observerCount = 0

    debugLog('🚀 Initializing embed autoresize system', {
      isInIframe: window.parent !== window,
      containerExists: !!containerRef.current,
      formId: form.id
    })

    const resizeIframe = (source = 'unknown') => {
      if (containerRef.current && window.parent !== window) {
        const height = containerRef.current.scrollHeight
        const adjustedHeight = height + 20 // Add small buffer for padding

        // Only log if height actually changed or this is initial/significant event
        const heightChanged = height !== lastHeight
        const shouldLog = heightChanged || source === 'initial' || resizeCount % 50 === 0 // Log every 50th call

        if (shouldLog) {
          debugLog(`📏 Height ${heightChanged ? 'changed' : 'unchanged'}`, {
            source,
            oldHeight: lastHeight,
            newHeight: height,
            adjustedHeight,
            resizeCount,
            pollingCount,
            observerCount
          })
        }

        if (heightChanged) {
          window.parent.postMessage({
            type: 'iframeResize',
            payload: { height: adjustedHeight }
          }, '*')

          debugLog('📤 PostMessage sent to parent', {
            type: 'iframeResize',
            height: adjustedHeight,
            source
          })

          lastHeight = height
        }

        resizeCount++
        if (source === 'polling') pollingCount++
        if (source === 'observer') observerCount++
      } else {
        if (resizeCount === 0) { // Only log this once
          debugLog('❌ Resize skipped', {
            containerExists: !!containerRef.current,
            isInIframe: window.parent !== window,
            reason: !containerRef.current ? 'No container' : 'Not in iframe'
          })
        }
      }
    }

    // Initial resize
    debugLog('🎯 Triggering initial resize')
    resizeIframe('initial')

    // Set up ResizeObserver to watch for content changes
    debugLog('👀 Setting up ResizeObserver')
    const resizeObserver = new ResizeObserver((entries) => {
      debugLog('🔍 ResizeObserver triggered', {
        entriesCount: entries.length,
        entry: entries[0] ? {
          contentRect: entries[0].contentRect,
          borderBoxSize: entries[0].borderBoxSize?.[0]
        } : null
      })
      resizeIframe('observer')
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
      debugLog('✅ ResizeObserver attached to container')
    } else {
      debugLog('❌ Container not available for ResizeObserver')
    }

    // Also listen for form changes that might affect height
    debugLog('⏰ Starting polling timer (100ms interval)')
    const timer = setInterval(() => resizeIframe('polling'), 100)

    return () => {
      debugLog('🧹 Cleaning up resize system', {
        finalStats: {
          totalResizes: resizeCount,
          pollingTriggers: pollingCount,
          observerTriggers: observerCount,
          finalHeight: lastHeight
        }
      })
      clearInterval(timer)
      resizeObserver.disconnect()
    }
  }, [])

  const handleBookingSubmit = async (data: BookingSubmitData) => {
    try {
      console.log('Submitting booking:', data)

      const response = await fetch('/api/bookings/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: organization.id,
          bookingData: data
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit booking')
      }

      // Notify parent window of successful submission
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'bookingSubmitted',
          payload: {
            formId: form.id,
            data: data,
            success: true
          }
        }, '*')
      }

      return result

    } catch (error) {
      console.error('Booking submission error:', error)

      // Notify parent window of submission error
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'bookingSubmitted',
          payload: {
            formId: form.id,
            data: data,
            success: false,
            error: error instanceof Error ? error.message : 'Submission failed'
          }
        }, '*')
      }

      throw error // Re-throw so BookingFlow can handle the error
    }
  }

  return (
    <div
      ref={containerRef}
      className={`${theme} bg-background text-foreground`}
      style={{
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* BookingFlow Component - same as hosted form but without header/footer/padding */}
      <BookingFlow
        id="embed-booking-flow"
        startTitle={form.formConfig?.serviceTree?.label || form.name}
        startDescription={form.formConfig?.serviceTree?.description || 'Select a service to get started'}
        services={services}
        baseQuestions={baseQuestions}
        primaryColor={primaryColor}
        darkMode={theme === 'dark'}
        bookingState={bookingState}
        onBookingStateChange={setBookingState}
        onBookingSubmit={handleBookingSubmit}
        organizationId={organization.id}
        organizationName={organization.name}
        organizationPhone={organization.phone}
        organizationTimezone={organization.timezone}
        className="bg-background rounded-lg p-4 lg:p-6"
      />
    </div>
  )
}