import { useState, FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { User } from 'lucide-react'

import { useListOrganizations, useSession } from '@/lib/auth/auth-hooks'
import { completeOnboarding } from '@/features/organization/lib/onboarding.server'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import { FormErrorBoundary } from '@/taali/components/form/form-error-boundary'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

interface OnboardingFormProps {
  // No invitation support in JoeyJob
}

function OnboardingFormInner(_props: OnboardingFormProps) {
  const { data: session, refetch: refetchSession } = useSession()
  const { refetch: refetchOrganizations } = useListOrganizations()

  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const { showError, showSuccess } = useErrorHandler()

  // Pre-fill from OAuth data if available
  const nameParts = session?.user?.name?.split(' ') || []
  const [formData, setFormData] = useState({
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      showError(
        new AppError(
          ERROR_CODES.VAL_REQUIRED_FIELD,
          400,
          { field: t('onboarding.firstName') },
          t('onboarding.fillFields')
        )
      )
      return
    }

    setIsSubmitting(true)

    try {
      const result = await completeOnboarding({
        data: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
        },
      })

      if (result.success) {
        // Show success message
        showSuccess('Profile completed successfully!')

        // Refetch session to get updated user data
        await refetchSession()
        await refetchOrganizations()

        // Navigate based on user type
        if (result.userType === 'simpro') {
          // Simpro users go to organization selection
          await navigate({ to: '/select-organization' })
        } else if (session?.user?.role === 'superadmin') {
          // Superadmin users go to admin panel
          await navigate({ to: '/superadmin' })
        } else {
          // Regular users go to app (subscription check will handle redirects)
          await navigate({ to: '/' })
        }
      }
    } catch (error) {
      showError(error)
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
        <h1 className="text-2xl font-bold text-foreground">{t('onboarding.completeProfile')}</h1>
        <p className="text-muted-foreground mt-2">{t('onboarding.setupProfile')}</p>
      </div>


      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="firstName">
            {t('onboarding.firstName')}
          </Label>
          <Input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
            placeholder={t('onboarding.firstNamePlaceholder')}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">
            {t('onboarding.lastName')}
          </Label>
          <Input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
            placeholder={t('onboarding.lastNamePlaceholder')}
            required
            disabled={isSubmitting}
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? t('onboarding.settingUp') : t('onboarding.complete')}
        </Button>
      </form>
    </div>
  )
}

// Export with error boundary wrapper
export function OnboardingForm(props: OnboardingFormProps) {
  return (
    <FormErrorBoundary>
      <OnboardingFormInner {...props} />
    </FormErrorBoundary>
  )
}
