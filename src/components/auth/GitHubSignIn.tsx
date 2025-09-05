import { authClient } from '@/lib/auth-client'
import { Github } from 'lucide-react'
import { toast } from 'sonner'

export function GitHubSignIn() {
  const handleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: 'github',
        callbackURL: '/'
      })
    } catch (error) {
      toast.error('Failed to sign in with GitHub')
      console.error('GitHub sign in error:', error)
    }
  }

  // Only show if GitHub is configured
  if (!process.env.GITHUB_CLIENT_ID) {
    return null
  }

  return (
    <button
      onClick={handleSignIn}
      className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-input rounded-lg hover:bg-accent transition-colors"
    >
      <Github className="w-5 h-5" />
      Continue with GitHub
    </button>
  )
}