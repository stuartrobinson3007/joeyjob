import { useState } from 'react'
import { Mail, Shield, ArrowRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import { authClient } from '@/lib/auth/auth-client'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/ui/input-otp'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { useSession } from '@/lib/auth/auth-hooks'
import { Button } from '@/taali/components/ui/button'
import { Input } from '@/taali/components/ui/input'

export function SuperadminSignIn() {
  const { t } = useTranslation('admin')
  const { showError, showSuccess } = useErrorHandler()
  const { refetch } = useSession()
  const navigate = useNavigate()
  
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      showError('Please enter your email')
      return
    }

    setIsSubmitting(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      })
      
      showSuccess('Verification code sent to your email')
      setStep('otp')
    } catch (error) {
      showError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      showError('Please enter the complete 6-digit code')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp,
      })

      if (result.error) {
        showError(result.error.message || 'Invalid verification code')
      } else {
        showSuccess('Successfully authenticated')
        
        // Force session cache refresh to ensure useSession() sees the new session
        await refetch()
        
        // Note: Admin role must be manually set in database
        // This just authenticates the user
        await navigate({ to: '/superadmin' })
      }
    } catch (error) {
      showError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendOTP = async () => {
    setIsSubmitting(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      })
      showSuccess('New verification code sent')
    } catch (error) {
      showError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-accent/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-full mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-card-foreground">Superadmin Sign In</h1>
            <p className="text-muted-foreground mt-2">
              {step === 'email' 
                ? 'Enter your email to receive a verification code'
                : `Enter the code sent to ${email}`
              }
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  autoFocus
                  startSlot={<Mail className="size-4 text-muted-foreground" />}
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full"
                loading={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send Verification Code'}
                {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">
                  Verification Code
                </label>
                <div className="flex justify-center">
                  <InputOTP 
                    value={otp} 
                    onChange={setOtp} 
                    maxLength={6} 
                    disabled={isSubmitting}
                  >
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

              <Button
                onClick={handleVerifyOTP}
                disabled={otp.length !== 6 || isSubmitting}
                className="w-full"
                loading={isSubmitting}
              >
                {isSubmitting ? 'Verifying...' : 'Sign In'}
              </Button>

              <div className="text-center space-y-2">
                <button
                  onClick={handleResendOTP}
                  disabled={isSubmitting}
                  className="text-sm text-primary hover:text-primary/80 underline disabled:opacity-50"
                >
                  Resend Code
                </button>
                
                <button
                  onClick={() => {
                    setStep('email')
                    setOtp('')
                  }}
                  className="block w-full text-sm text-muted-foreground hover:text-card-foreground"
                >
                  ← Use Different Email
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning">
              <strong>Important:</strong> Admin privileges must be manually granted in the database. 
              This sign-in only authenticates your identity.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}