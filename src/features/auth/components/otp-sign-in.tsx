import { useState } from 'react'
import { Mail, ArrowRight } from 'lucide-react'

import { authClient } from '@/lib/auth/auth-client'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/ui/input-otp'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'

interface OTPSignInProps {
  email: string
  onSuccess?: () => void
  onBack?: () => void
}

export function OTPSignIn({ email, onSuccess, onBack }: OTPSignInProps) {
  const { t } = useTranslation('auth')
  const { showError, showSuccess } = useErrorHandler()
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const handleSendOTP = async () => {
    setIsSending(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      })
      showSuccess(t('otp.codeSent'))
    } catch (error) {
      showError(error)
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmitOTP = async () => {
    if (otp.length !== 6) {
      showError(t('otp.codeIncomplete'))
      return
    }

    setIsSubmitting(true)
    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp,
      })

      if (result.error) {
        showError(result.error.message || t('errors.invalidCode'))
      } else {
        showSuccess(t('otp.signedIn'))
        onSuccess?.()
      }
    } catch (error) {
      showError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOTPChange = (value: string) => {
    setOtp(value)
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-full mb-4">
          <Mail className="w-8 h-8 text-accent-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t('otp.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('otp.description', { email })}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t('otp.codeIncomplete')}
          </label>
          <div className="flex justify-center">
            <InputOTP value={otp} onChange={handleOTPChange} maxLength={6} disabled={isSubmitting}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>

        <button
          onClick={handleSubmitOTP}
          disabled={otp.length !== 6 || isSubmitting}
          className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('states.signingIn') : t('otp.signIn')}
          <ArrowRight className="w-4 h-4 ml-2 inline" />
        </button>
      </div>

      <div className="text-center space-y-3">
        <button
          onClick={handleSendOTP}
          disabled={isSending}
          className="text-sm text-primary hover:text-primary/80 underline disabled:opacity-50"
        >
          {isSending ? t('states.sending') : t('otp.resendCode')}
        </button>

        {onBack && (
          <button
            onClick={onBack}
            className="block w-full text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t('otp.back')}
          </button>
        )}
      </div>
    </div>
  )
}
