import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { Phone, Mail, AlertCircle } from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/ui/card'
import BookingFlow, { BookingState, BookingSubmitData } from '@/features/booking/components/form-editor/booking-flow'

// Note: Server function will be called dynamically in the loader
// to avoid bundling server code into client

export const Route = createFileRoute('/_booking-form/f/$orgSlug/$formSlug')({
  head: ({ loaderData }) => {
    // Extract theme information for injection
    const theme = loaderData?.form?.theme || 'light'
    const primaryColor = loaderData?.form?.primaryColor || '#3B82F6'
    const orgName = loaderData?.organization?.name || 'Booking'
    const formName = loaderData?.form?.name || 'Book Appointment'

    return {
      meta: [
        {
          charSet: 'utf-8',
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          title: `${formName} - ${orgName}`,
        },
      ],
      htmlProps: {
        className: theme,
        style: `--primary: ${primaryColor}; --form-primary: ${primaryColor};`
      }
    }
  },
  component: HostedBookingPage,
  loader: async ({ params }) => {
    try {
      const { getBookingFormBySlug } = await import('@/features/booking/lib/forms.server')
      return await getBookingFormBySlug({
        data: {
          orgSlug: params.orgSlug,
          formSlug: params.formSlug
        }
      })
    } catch (error) {
      console.error('❌ [SSR LOADER] Error:', error)

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

    console.log('🔍 [ERROR COMPONENT] Displaying with theme:', {
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
              Contact {organizationData?.name || 'our team'} to schedule your appointment
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {(hasPhone || hasEmail) ? (
              <div className="space-y-4">

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
                        Call →
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

function HostedBookingPage() {
  const loaderData = Route.useLoaderData()
  const { form, organization } = loaderData
  const containerRef = useRef<HTMLDivElement>(null)

  // Debug logging
  console.log('🎨 [CLIENT COMPONENT] Received loader data:', {
    formExists: !!form,
    formName: form?.name,
    formTheme: form?.theme,
    formActive: form?.isActive,
    orgName: organization?.name,
    formConfigExists: !!form?.formConfig,
    servicesCount: form?.formConfig?.serviceTree?.children?.length || 0,
    questionsCount: form?.formConfig?.baseQuestions?.length || 0
  })

  // Theme and styling from form config
  const theme = form.theme || 'light'
  const primaryColor = form.primaryColor || '#3B82F6'

  console.log('🎨 [CLIENT COMPONENT] Applied theme:', theme)
  console.log('🎨 [CLIENT COMPONENT] Document class should be:',
    typeof document !== 'undefined' ? document?.documentElement?.className : 'SSR - no document'
  )

  // Extract services and questions from form config
  const services = form.formConfig?.serviceTree?.children || []
  const baseQuestions = form.formConfig?.baseQuestions || []

  console.log('🎨 [CLIENT COMPONENT] Services and questions:', {
    servicesCount: services.length,
    questionsCount: baseQuestions.length,
    serviceTree: form.formConfig?.serviceTree,
    firstServiceDetails: services[0] ? {
      id: services[0].id,
      label: services[0].label,
      type: services[0].type,
      description: services[0].description,
      price: services[0].price,
      duration: services[0].duration,
      hasDescription: !!services[0].description,
      hasPrice: !!services[0].price,
      hasDuration: !!services[0].duration,
      allKeys: Object.keys(services[0])
    } : null
  })

  // BookingFlow state management
  const [bookingState, setBookingState] = useState<BookingState>({
    stage: 'selection',
    navigationPath: [],
    selectedService: null,
    selectedEmployee: null,
    selectedDate: null,
    selectedTime: null,
  })

  // Theme is now applied via head function htmlProps - no manual DOM manipulation needed

  // Employee fetching is now handled by the unified availability API in BookingFlow

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

      // Don't show toast here - let BookingFlow handle success/error messaging
      return result

    } catch (error) {
      console.error('Booking submission error:', error)
      throw error // Re-throw so BookingFlow can handle the error
    }
  }

  return (
    <div
      ref={containerRef}
      className={`${theme} min-h-screen bg-muted text-foreground flex flex-col`}
    >
      {/* Organization Header */}
      <header className="border-b bg-background/50">
        <div className="container max-w-7xl mx-auto py-6 px-6">
          <div className="flex items-center gap-4">
            {organization.logo && (
              <img
                src={organization.logo}
                alt={organization.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-xl font-semibold">{organization.name}</h1>
              <p className="text-sm text-muted-foreground">
                Powered by JoeyJob
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto py-16 px-6 flex-1">
        {/* BookingFlow Component */}
        <BookingFlow
          id="hosted-booking-flow"
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
          className="bg-background shadow-lg rounded-lg p-4 lg:p-8"
        />
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container max-w-4xl mx-auto py-6 px-6 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {organization.name}. Powered by{' '}
            <a
              href="https://joeyjob.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              JoeyJob
            </a>
          </p>
          <div className="mt-2 space-x-4">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}