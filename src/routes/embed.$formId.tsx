import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'

import { FormFieldRenderer } from '@/features/booking/components/form-field-renderer'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Button } from '@/ui/button'
import { Form } from '@/ui/form'
import { toast } from 'sonner'
import { formatServicePrice } from '@/lib/utils/price-formatting'

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
      // Security headers via meta tags (limited effectiveness, ideally set at server level)
      {
        'http-equiv': 'X-Frame-Options',
        content: 'ALLOWALL', // Allow embedding in iframes
      },
      {
        'http-equiv': 'X-Content-Type-Options',
        content: 'nosniff',
      },
    ],
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
  const { form, service } = Route.useLoaderData()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const formHook = useForm()

  // Theme from form config
  const theme = form.theme || 'light'

  // Prepare form fields from the form configuration
  const formFields = Array.isArray(form.fields) ? form.fields : []

  // Auto-resize functionality for iframe
  useEffect(() => {
    const resizeIframe = () => {
      if (containerRef.current && window.parent !== window) {
        const height = containerRef.current.scrollHeight
        window.parent.postMessage({
          type: 'iframeResize',
          payload: { height: height + 20 } // Add small buffer for padding
        }, '*')
      }
    }

    // Initial resize
    resizeIframe()

    // Set up ResizeObserver to watch for content changes
    const resizeObserver = new ResizeObserver(() => {
      resizeIframe()
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Also listen for form changes that might affect height
    const timer = setInterval(resizeIframe, 100)

    return () => {
      clearInterval(timer)
      resizeObserver.disconnect()
    }
  }, [])

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      // TODO: Submit booking data to server
      console.log('Form submission:', data)
      
      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 1000))
      
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
      
      toast.success('Booking Request Submitted!', {
        description: 'We will contact you shortly to confirm your appointment.',
        duration: 10000,
      })
      
      // Reset form
      formHook.reset()
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
      
      toast.error('Submission Failed', {
        description: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div 
      ref={containerRef}
      className={`${theme} min-h-screen bg-background p-4`}
      style={{
        margin: 0,
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">{form.name}</h1>
        {form.formConfig?.serviceTree?.description && (
          <p className="text-muted-foreground">{form.formConfig.serviceTree.description}</p>
        )}
        {service && (
          <p className="text-sm text-muted-foreground mt-2">
            Book your {service.name} appointment
          </p>
        )}
      </div>

      {/* Booking Form */}
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-sm border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Complete Your Information</CardTitle>
            {service && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Service:</strong> {service.name}</p>
                <p><strong>Duration:</strong> {service.duration} minutes</p>
                <p><strong>Price:</strong> {formatServicePrice(service.price)}</p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Form {...formHook}>
              <form onSubmit={formHook.handleSubmit(handleSubmit)} className="space-y-6">
                {formFields.map((fieldConfig) => (
                  <FormFieldRenderer
                    key={fieldConfig.id}
                    field={fieldConfig}
                    control={formHook.control}
                  />
                ))}
                
                <div className="flex justify-center pt-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="min-w-[200px]"
                    size="lg"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Booking Request'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by JoeyJob
        </p>
      </footer>
    </div>
  )
}