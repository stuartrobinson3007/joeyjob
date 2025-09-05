import { useState, FormEvent } from 'react'
import { useSession } from '@/lib/auth/auth-hooks'
import { completeOnboarding } from '@/features/organization/lib/onboarding.server'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { User, Building2 } from 'lucide-react'

interface OnboardingFormProps {
  invitationId?: string
  organizationName?: string
}

export function OnboardingForm({ invitationId, organizationName }: OnboardingFormProps) {
  const { data: session, refetch } = useSession()

  const navigate = useNavigate()

  // Pre-fill from OAuth data if available
  const nameParts = session?.user?.name?.split(' ') || []
  const [formData, setFormData] = useState({
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await completeOnboarding({
        data: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          invitationId
        }
      })

      if (result.success) {
        // Store the organization ID in sessionStorage and localStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('activeOrganizationId', result.organizationId)
          localStorage.setItem('activeOrganizationId', result.organizationId)
        }

        toast.success(
          result.isInvite
            ? `Welcome to ${organizationName}!`
            : 'Welcome! Your workspace has been created.'
        )

        // Refetch session to get updated user data
        await refetch()

        // Navigate to home
        await navigate({ to: '/' })
      }
    } catch (error) {
      console.error('Onboarding error:', error)
      toast.error('Failed to complete setup. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Complete Your Profile</h1>
        <p className="text-muted-foreground mt-2">
          Just a few more details to get you started
        </p>
      </div>

      {invitationId && organizationName && (
        <div className="mb-6 p-4 bg-info/10 border border-info/20 rounded-lg">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-info flex-shrink-0" />
            <p className="text-info text-sm">
              You'll join <strong>{organizationName}</strong> after completing setup
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1">
            First Name
          </label>
          <input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder="John"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1">
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder="Doe"
            required
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Setting up...' : 'Complete Setup'}
        </button>
      </form>
    </div>
  )
}