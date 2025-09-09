import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { FormFieldRenderer } from '@/features/booking/components/form-field-renderer'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Button } from '@/ui/button'
import { Form } from '@/ui/form'
import { toast } from 'sonner'

// Note: Server function will be called dynamically in the loader
// to avoid bundling server code into client

export const Route = createFileRoute('/book/$formId')({
  component: CustomerBookingPage,
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
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
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

function CustomerBookingPage() {
  const { form, service } = Route.useLoaderData()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const formHook = useForm()

  // Prepare form fields from the form configuration
  const formFields = Array.isArray(form.fields) ? form.fields : []

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      // TODO: Submit booking data to server
      console.log('Form submission:', data)
      
      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast.success('Booking Request Submitted!', {
        description: 'We will contact you shortly to confirm your appointment.',
        duration: 10000,
      })
      
      // Reset form
      formHook.reset()
    } catch (error) {
      console.error('Booking submission error:', error)
      toast.error('Submission Failed', {
        description: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container max-w-4xl mx-auto py-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{form.name}</h1>
            {form.description && (
              <p className="text-muted-foreground mt-1">{form.description}</p>
            )}
            {service && (
              <p className="text-sm text-muted-foreground mt-2">
                Book your {service.name} appointment
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Booking Form */}
      <div className="container max-w-2xl mx-auto py-8">
        <Card className="bg-background shadow-sm">
          <CardHeader>
            <CardTitle>Complete Your Information</CardTitle>
            {service && (
              <div className="text-sm text-muted-foreground">
                <p><strong>Service:</strong> {service.name}</p>
                <p><strong>Duration:</strong> {service.duration} minutes</p>
                <p><strong>Price:</strong> ${service.price}</p>
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
                
                <div className="flex justify-center pt-6">
                  <Button type="submit" disabled={isSubmitting} className="min-w-[200px]">
                    {isSubmitting ? 'Submitting...' : 'Submit Booking Request'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t bg-background/50">
        <div className="container max-w-4xl mx-auto py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by JoeyJob - Online Booking Platform
          </p>
        </div>
      </footer>
    </div>
  )
}