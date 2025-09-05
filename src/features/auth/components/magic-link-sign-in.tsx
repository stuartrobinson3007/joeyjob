import { useState } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { toast } from 'sonner'
import { Mail, Loader2 } from 'lucide-react'

export function MagicLinkSignIn() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast.error('Please enter your email')
      return
    }

    setIsLoading(true)
    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: '/'
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to send magic link')
      } else {
        setIsSent(true)
        toast.success('Magic link sent! Check your email.')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
      console.error('Magic link error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <Mail className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <h3 className="text-lg font-medium text-green-900">Check your email!</h3>
          <p className="text-sm text-green-700 mt-1">
            We've sent a magic link to <strong>{email}</strong>
          </p>
          <p className="text-xs text-green-600 mt-2">
            The link will expire in 5 minutes
          </p>
        </div>
        <button
          onClick={() => {
            setIsSent(false)
            setEmail('')
          }}
          className="text-sm text-primary hover:text-primary/80"
        >
          Try a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
          disabled={isLoading}
          required
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="w-4 h-4" />
            Send Magic Link
          </>
        )}
      </button>
    </form>
  )
}