import { Github } from 'lucide-react'

import { authClient } from '@/lib/auth/auth-client'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'

export function GitHubSignIn() {
  const { t } = useTranslation('auth')
  const { showError } = useErrorHandler()

  const handleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: 'github',
        callbackURL: '/',
      })
    } catch (error) {
      showError(error)
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
      {t('signin.providers.github')}
    </button>
  )
}
