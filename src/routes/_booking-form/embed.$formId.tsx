import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { Phone, Mail, AlertCircle } from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/ui/card'
import BookingFlow, { BookingState, BookingSubmitData } from '@/features/booking/components/form-editor/booking-flow'

// Note: Server function will be called dynamically in the loader
// to avoid bundling server code into client

export const Route = createFileRoute('/_booking-form/embed/$formId')({
  head: ({ loaderData }) => {
    // Extract theme information for injection
    const theme = loaderData?.form?.theme || 'light'
    const primaryColor = loaderData?.form?.primaryColor || '#3B82F6'
    const orgName = loaderData?.organization?.name || 'Booking'

    return {
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          name: 'robots',
          content: 'noindex, nofollow',
        },
        {
          title: `${orgName} - Booking`,
        },
      ],
      htmlProps: {
        className: theme,
        style: `--primary: ${primaryColor}; --form-primary: ${primaryColor};`
      }
    }
  },
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
    try {
      const { getBookingForm } = await import('@/features/booking/lib/forms.server')
      return await getBookingForm({ data: { id: params.formId } })
    } catch (error) {
      console.error('❌ [EMBED LOADER] Error:', error)

      // Extract data from AppError context (server now includes theme in all errors)
      let organizationData = null;
      let theme = 'light';
      let primaryColor = '#3B82F6';

      if (error && typeof error === 'object' && 'context' in error) {
        const context = (error as any).context;
        organizationData = context.organizationData || null;
        theme = context.theme || 'light';
        primaryColor = context.primaryColor || '#3B82F6';
      }

      // Create clean error message with theme data
      const errorPayload = {
        message: error instanceof Error ? error.message : 'Unable to load booking form',
        organizationData,
        theme,
        primaryColor
      };

      throw new Error(JSON.stringify(errorPayload));
    }
  },
  errorComponent: ({ error }) => {
    // Parse the clean JSON structure from loader
    const parsed = JSON.parse(error.message);
    const organizationData = parsed.organizationData;
    const errorMessage = parsed.message;
    const theme = parsed.theme || 'light';
    const primaryColor = parsed.primaryColor || '#3B82F6';

    console.log('🔍 [EMBED ERROR COMPONENT] Displaying with theme:', {
      theme,
      primaryColor,
      hasContact: !!(organizationData?.phone || organizationData?.email)
    });

    const hasPhone = organizationData?.phone && organizationData.phone.trim() !== '';
    const hasEmail = organizationData?.email && organizationData.email.trim() !== '';

    return (
      <div
        className={`${theme} min-h-screen flex items-center justify-center bg-background p-4`}
        style={{ '--primary': primaryColor } as React.CSSProperties}
      >
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-warning" />
            </div>
            <h2 className="text-2xl font-semibold text-center">Booking Temporarily Unavailable</h2>
            <p className="text-center text-muted-foreground mt-2 text-sm">
              {errorMessage}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {(hasPhone || hasEmail) ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Contact {organizationData?.name || 'our team'} to schedule your appointment
                  </p>
                </div>

                <div className="space-y-3">
                  {hasPhone && (
                    <a
                      href={`tel:${organizationData.phone}`}
                      className="flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Call Us</p>
                          <p className="text-xs text-muted-foreground">{organizationData.phone}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        Tap to call →
                      </span>
                    </a>
                  )}

                  {hasEmail && (
                    <a
                      href={`mailto:${organizationData.email}?subject=Booking Inquiry`}
                      className="flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Email Us</p>
                          <p className="text-xs text-muted-foreground">{organizationData.email}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        Send email →
                      </span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Please contact {organizationData?.name || 'the business'} directly to schedule your appointment.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  },
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

      // Transform formData keys from field IDs to question labels
      const transformedFormData: Record<string, any> = {}

      Object.entries(data.formData).forEach(([fieldId, value]) => {
        const questionLabel = data.questionLabels[fieldId] || fieldId
        transformedFormData[questionLabel] = value
      })

      const transformedData = {
        ...data,
        formData: transformedFormData
      }

      const response = await fetch('/api/bookings/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: organization.id,
          bookingData: transformedData
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
        bookingState={bookingState}
        onBookingStateChange={setBookingState}
        onBookingSubmit={handleBookingSubmit}
        organizationId={organization.id}
        organizationName={organization.name}
        organizationPhone={organization.phone}
        organizationEmail={organization.email}
        organizationTimezone={organization.timezone}
        className="bg-background rounded-lg p-4 lg:p-6"
      />
    </div>
  )
}