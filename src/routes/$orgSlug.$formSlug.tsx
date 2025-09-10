import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'

import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { toast } from 'sonner'
import { cn } from '@/taali/lib/utils'
import BookingFlow, { BookingState, BookingSubmitData } from '@/features/booking/components/form-editor/booking-flow'

// Note: Server function will be called dynamically in the loader
// to avoid bundling server code into client

export const Route = createFileRoute('/$orgSlug/$formSlug')({
  component: HostedBookingPage,
  head: ({ loaderData }) => ({
    title: `${loaderData?.form?.name || 'Book Now'} - ${loaderData?.organization?.name || 'JoeyJob'}`,
    meta: [
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'description',
        content: loaderData?.form?.description || `Book your appointment with ${loaderData?.organization?.name || 'us'}`,
      },
      {
        name: 'robots',
        content: 'index, follow',
      },
    ],
  }),
  loader: async ({ params }) => {
    // This is a public route - no auth required for customers
    try {
      // Dynamically import and call the server function
      const { getBookingFormBySlug } = await import('@/features/booking/lib/forms.server')
      const formData = await getBookingFormBySlug({ 
        data: { 
          orgSlug: params.orgSlug,
          formSlug: params.formSlug
        } 
      })
      
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
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
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
  const { form, organization } = Route.useLoaderData()
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
    selectedDate: null,
    selectedTime: null,
  })

  // Apply theme class to document body
  useEffect(() => {
    const isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    
    return () => {
      // Don't clean up theme on unmount - let it persist
    }
  }, [theme])

  const handleBookingSubmit = async (data: BookingSubmitData) => {
    try {
      // TODO: Submit booking data to server
      console.log('Booking submission:', data)
      
      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast.success('Booking Request Submitted!', {
        description: 'We will contact you shortly to confirm your appointment.',
        duration: 10000,
      })
      
    } catch (error) {
      console.error('Booking submission error:', error)
      
      toast.error('Submission Failed', {
        description: 'An unexpected error occurred. Please try again.',
      })
    }
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "min-h-screen bg-background text-foreground transition-colors duration-200",
        theme === 'dark' ? 'dark' : ''
      )}
      style={{
        '--primary': primaryColor,
        '--primary-foreground': theme === 'dark' ? '#ffffff' : '#ffffff',
      } as React.CSSProperties}
    >
      {/* Organization Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto py-6 px-6">
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
      <main className="container max-w-4xl mx-auto py-12 px-6">
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
          className="bg-transparent"
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