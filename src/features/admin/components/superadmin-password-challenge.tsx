import { useState } from 'react'
import { Shield, Lock } from 'lucide-react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { validateSuperadminPassword } from '@/features/admin/lib/superadmin-auth.server'
import { Button } from '@/taali/components/ui/button'
import { Input } from '@/taali/components/ui/input'

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
    
    if (!password) {
      showError('Please enter a password')
      return
    }
    
    setIsVerifying(true)
    
    try {
      
      // Validate password on the server - password never exposed to client
      const result = await validateSuperadminPassword({ data: { password } })
      
      if (result.valid) {
        onSuccess()
      } else {
        showError(result.error || 'Invalid password')
        setPassword('')
      }
    } catch (error) {
      // Server error or configuration issue
      showError('Unable to verify password. Please try again.')
      setPassword('')
    } finally {
      setIsVerifying(false)
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
            <h1 className="text-2xl font-bold text-card-foreground">Superadmin Access</h1>
            <p className="text-muted-foreground mt-2">Enter the access password to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Access Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoFocus
                startSlot={<Lock className="size-4 text-muted-foreground" />}
              />
            </div>

            <Button
              type="submit"
              disabled={isVerifying || !password}
              className="w-full"
              loading={isVerifying}
            >
              {isVerifying ? 'Verifying...' : 'Continue'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}