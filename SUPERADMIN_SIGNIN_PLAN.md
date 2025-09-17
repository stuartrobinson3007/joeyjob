# Superadmin Sign-In Flow Implementation Plan

## Overview
Implement a secure, password-protected superadmin sign-in flow using Better Auth's email OTP functionality. The sign-in page will be protected by a password, and admin roles will be manually assigned in the database for security.

## Implementation Steps

### 1. Create Password-Protected Superadmin Sign-In Route

#### File: `/src/routes/superadmin/signin.tsx`
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Navigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { SuperadminPasswordChallenge } from '@/features/admin/components/superadmin-password-challenge'
import { SuperadminSignIn } from '@/features/admin/components/superadmin-sign-in'
import { useSession } from '@/lib/auth/auth-hooks'

export const Route = createFileRoute('/superadmin/signin')({
  component: SuperadminSignInPage,
})

function SuperadminSignInPage() {
  const { data: session, isPending } = useSession()
  const [isPasswordVerified, setIsPasswordVerified] = useState(false)

  useEffect(() => {
    // Check if password was previously verified in this session
    const verified = sessionStorage.getItem('superadmin_password_verified')
    if (verified === 'true') {
      setIsPasswordVerified(true)
    }
  }, [])

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  // If already signed in as superadmin, redirect to dashboard
  if (session?.user?.role === 'superadmin') {
    return <Navigate to="/superadmin" />
  }

  // Show password challenge first
  if (!isPasswordVerified) {
    return (
      <SuperadminPasswordChallenge 
        onSuccess={() => {
          setIsPasswordVerified(true)
          sessionStorage.setItem('superadmin_password_verified', 'true')
        }}
      />
    )
  }

  // Show superadmin sign-in form
  return <SuperadminSignIn />
}
```

### 2. Create Server-Side Password Validation

#### File: `/src/features/admin/lib/superadmin-auth.server.ts`
```typescript
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const validateSuperadminPassword = createServerFn({ method: 'POST' })
  .validator(z.object({ 
    password: z.string().min(1, 'Password is required') 
  }))
  .handler(async ({ data }) => {
    // Access server-side environment variable (no VITE_ prefix)
    const correctPassword = process.env.SUPERADMIN_ACCESS_PASSWORD
    
    if (!correctPassword) {
      throw new Error('Superadmin access not configured on server')
    }
    
    const isValid = data.password === correctPassword
    
    return { 
      valid: isValid,
      error: isValid ? null : 'Invalid password'
    }
  })
```

### 3. Create Password Challenge Component

#### File: `/src/features/admin/components/superadmin-password-challenge.tsx`
```typescript
import { useState } from 'react'
import { Shield, Lock } from 'lucide-react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { validateSuperadminPassword } from '@/features/admin/lib/superadmin-auth.server'

interface SuperadminPasswordChallengeProps {
  onSuccess: () => void
}

export function SuperadminPasswordChallenge({ onSuccess }: SuperadminPasswordChallengeProps) {
  const { t } = useTranslation('admin')
  const { showError } = useErrorHandler()
  const [password, setPassword] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsVerifying(true)
    
    try {
      // Validate password on the server - password never exposed to client
      const result = await validateSuperadminPassword({ password })
      
      if (result.valid) {
        onSuccess()
      } else {
        showError(result.error || 'Invalid password')
        setPassword('')
      }
    } catch (error) {
      showError('Unable to verify password. Please try again.')
      setPassword('')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-purple-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Superadmin Access</h1>
            <p className="text-gray-600 mt-2">Enter the access password to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Access Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter password"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifying || !password}
              className="w-full py-2 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? 'Verifying...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

### 4. Create Superadmin Sign-In Component with Email OTP

#### File: `/src/features/admin/components/superadmin-sign-in.tsx`
```typescript
import { useState } from 'react'
import { Mail, Shield, ArrowRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import { authClient } from '@/lib/auth/auth-client'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/ui/input-otp'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'

export function SuperadminSignIn() {
  const { t } = useTranslation('admin')
  const { showError, showSuccess } = useErrorHandler()
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
    <div className="min-h-screen bg-purple-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Superadmin Sign In</h1>
            <p className="text-gray-600 mt-2">
              {step === 'email' 
                ? 'Enter your email to receive a verification code'
                : `Enter the code sent to ${email}`
              }
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="admin@example.com"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full py-2 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? 'Sending...' : 'Send Verification Code'}
                {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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

              <button
                onClick={handleVerifyOTP}
                disabled={otp.length !== 6 || isSubmitting}
                className="w-full py-2 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Verifying...' : 'Sign In'}
              </button>

              <div className="text-center space-y-2">
                <button
                  onClick={handleResendOTP}
                  disabled={isSubmitting}
                  className="text-sm text-purple-600 hover:text-purple-700 underline disabled:opacity-50"
                >
                  Resend Code
                </button>
                
                <button
                  onClick={() => {
                    setStep('email')
                    setOtp('')
                  }}
                  className="block w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Use Different Email
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> Admin privileges must be manually granted in the database. 
              This sign-in only authenticates your identity.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 5. Update Environment Variables

#### File: `.env` or `.env.local`
```bash
# Superadmin access password (server-side only - no VITE_ prefix!)
SUPERADMIN_ACCESS_PASSWORD=your-secure-password-here
```

### 5. Update Route Tree to Include New Route

The route `/superadmin/signin` should be accessible without authentication, but protected by the password challenge.

### 6. Email Template for Superadmin OTP

The existing `sendOTPEmail` function in `/src/lib/utils/email.ts` will be reused. It already handles sign-in OTP emails.

### 7. Database Considerations

#### Manual Role Assignment
After a superadmin signs in for the first time, you'll need to manually update their role in the database:

```sql
UPDATE "user" 
SET role = 'superadmin' 
WHERE email = 'admin@example.com';
```

### 8. Security Features

1. **Password Protection**: The sign-in page itself is protected by a password stored in environment variables
2. **Session Storage**: Password verification is stored in session storage (cleared on browser close)
3. **Email OTP**: Uses Better Auth's secure OTP implementation
4. **Manual Role Assignment**: Admin roles are never automatically granted
5. **Visual Distinction**: Purple theme for superadmin interfaces

### 9. User Flow

1. Navigate to `/superadmin/signin`
2. Enter the access password (validated server-side against `SUPERADMIN_ACCESS_PASSWORD`)
3. Enter email address
4. Receive OTP code via email
5. Enter 6-digit OTP code
6. Authenticate successfully
7. Redirect to `/superadmin` dashboard (if role is set in DB)
8. If role not set, user is authenticated but won't have admin access

### 10. Integration with Existing System

- Uses existing Better Auth configuration with `emailOTP` plugin
- Reuses existing email sending infrastructure (`sendOTPEmail`)
- Integrates with existing superadmin routes and layouts
- Maintains separation from regular user authentication flow

### 11. Testing Checklist

- [ ] Password challenge blocks access to sign-in form
- [ ] Incorrect password shows error and clears input
- [ ] Correct password allows access to sign-in form
- [ ] Email validation works correctly
- [ ] OTP is sent successfully
- [ ] Invalid OTP shows error
- [ ] Valid OTP authenticates user
- [ ] Authenticated superadmin redirects to dashboard
- [ ] Non-superadmin users can't access admin areas
- [ ] Session storage clears on browser close

### 12. Future Enhancements (Optional)

- Rate limiting on password attempts
- IP allowlist for superadmin access
- Two-factor authentication requirement
- Audit logging for all superadmin actions
- Expiring OTP codes with configurable TTL
- Backup authentication methods

## Implementation Order

1. Create environment variable for password
2. Create password challenge component
3. Create superadmin sign-in component
4. Create the route file
5. Test the complete flow
6. Document the manual database update process

## Notes

- The purple theme is used consistently for superadmin interfaces
- The flow maintains security by requiring both password and email verification
- Admin roles must be manually granted in the database for maximum security
- The implementation uses Better Auth's existing plugins without custom modifications