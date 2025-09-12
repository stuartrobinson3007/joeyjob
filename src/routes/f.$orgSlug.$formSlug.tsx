import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'

import { Card, CardContent, CardHeader } from '@/ui/card'
import BookingFlow, { BookingState, BookingSubmitData } from '@/features/booking/components/form-editor/booking-flow'

// Note: Server function will be called dynamically in the loader
// to avoid bundling server code into client

export const Route = createFileRoute('/f/$orgSlug/$formSlug')({
  component: HostedBookingPage,
  loader: async ({ params }) => {
    // This is a public route - no auth required for customers
    console.log('🔍 [SSR LOADER] Starting loader for:', params)
    try {
      // Dynamically import and call the server function
      console.log('🔍 [SSR LOADER] Importing getBookingFormBySlug...')
      const { getBookingFormBySlug } = await import('@/features/booking/lib/forms.server')

      console.log('🔍 [SSR LOADER] Calling getBookingFormBySlug with:', {
        orgSlug: params.orgSlug,
        formSlug: params.formSlug
      })

      const formData = await getBookingFormBySlug({
        data: {
          orgSlug: params.orgSlug,
          formSlug: params.formSlug
        }
      })

      console.log('🔍 [SSR LOADER] Got form data:', {
        formExists: !!formData?.form,
        formName: formData?.form?.name,
        formTheme: formData?.form?.theme,
        formActive: formData?.form?.isActive,
        orgName: formData?.organization?.name
      })

      if (!formData || !formData.form.isActive) {
        console.log('❌ [SSR LOADER] Form not found or inactive')
        throw new Error('Booking form not found or inactive')
      }

      const result = {
        form: formData.form,
        organization: formData.organization,
        service: formData.service, // Service info embedded in form
      }

      console.log('✅ [SSR LOADER] Returning data to client:', {
        formTheme: result.form.theme,
        formName: result.form.name,
        orgName: result.organization.name
      })

      return result as {
        form: any
        organization: any
        service: any
      }
    } catch (error) {
      console.error('❌ [SSR LOADER] Error:', error)
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
          startDescription={form.description || 'Select a service to get started'}
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
          organizationTimezone={organization.timezone || 'Australia/Sydney'}
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
        </div>
      </footer>
    </div>
  )
}