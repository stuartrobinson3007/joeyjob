import { createFileRoute } from '@tanstack/react-router'
import { MagicLinkSignIn } from '@/features/auth/components/magic-link-sign-in'
import { GoogleSignIn } from '@/features/auth/components/google-sign-in'
import { GitHubSignIn } from '@/features/auth/components/github-sign-in'
import { Navigate } from '@tanstack/react-router'
import { useSession } from '@/lib/auth/auth-hooks'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/auth/signin')({
  component: SignInPage,
})

function SignInPage() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/" />
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Sign in to your account to continue</p>
        </div>

        <div className="bg-card p-8 rounded-xl shadow-lg space-y-6">
          <div>
            <h2 className="text-lg font-medium mb-4">Sign in with email</h2>
            <MagicLinkSignIn />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="space-y-3">
            <GoogleSignIn />
            <GitHubSignIn />
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          By signing in, you agree to our{' '}
          <a href="/terms" className="text-primary hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  )
}