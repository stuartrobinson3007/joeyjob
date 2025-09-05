import { useState } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/taali-ui/ui/input-otp'
import { toast } from 'sonner'
import { Mail, ArrowRight } from 'lucide-react'

interface OTPSignInProps {
  email: string
  onSuccess?: () => void
  onBack?: () => void
}

export function OTPSignIn({ email, onSuccess, onBack }: OTPSignInProps) {
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const handleSendOTP = async () => {
    setIsSending(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in"
      })
      toast.success('Verification code sent to your email')
    } catch (error) {
      toast.error('Failed to send verification code')
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmitOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the complete 6-digit code')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp
      })

      if (result.error) {
        toast.error(result.error.message || 'Invalid verification code')
      } else {
        toast.success('Successfully signed in!')
        onSuccess?.()
      }
    } catch (error) {
      toast.error('Failed to sign in with verification code')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Auto-submit when OTP is complete
  const handleOTPChange = (value: string) => {
    setOtp(value)
    if (value.length === 6) {
      handleSubmitOTP()
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-full mb-4">
          <Mail className="w-8 h-8 text-accent-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Check Your Email</h1>
        <p className="text-muted-foreground mt-2">
          We've sent a 6-digit code to <strong>{email}</strong>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Enter verification code
          </label>
          <div className="flex justify-center">
            <InputOTP 
              value={otp} 
              onChange={handleOTPChange}
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

        <button
          onClick={handleSubmitOTP}
          disabled={otp.length !== 6 || isSubmitting}
          className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Signing in...' : 'Continue'}
          <ArrowRight className="w-4 h-4 ml-2 inline" />
        </button>
      </div>

      <div className="text-center space-y-3">
        <button
          onClick={handleSendOTP}
          disabled={isSending}
          className="text-sm text-primary hover:text-primary/80 underline disabled:opacity-50"
        >
          {isSending ? 'Sending...' : 'Resend code'}
        </button>
        
        {onBack && (
          <button
            onClick={onBack}
            className="block w-full text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to invitation
          </button>
        )}
      </div>
    </div>
  )
}