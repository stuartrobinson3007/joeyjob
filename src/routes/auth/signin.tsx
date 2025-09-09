import { createFileRoute } from '@tanstack/react-router'
import { Navigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { SimProSignIn } from '@/features/auth/components/simpro-sign-in'
import { useSession } from '@/lib/auth/auth-hooks'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export const Route = createFileRoute('/auth/signin')({
  component: SignInPage,
})

function SignInPage() {
  const { data: session, isPending } = useSession()
  const { t } = useTranslation('auth')

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
          <h1 className="text-3xl font-bold">{t('signin.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('signin.subtitle')}</p>
        </div>

        <div className="bg-card p-8 rounded-xl shadow-lg">
          <SimProSignIn />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t('signin.terms')}{' '}
          <a href="/terms" className="text-primary hover:underline">
            {t('signin.termsLink')}
          </a>{' '}
          {t('signin.and')}{' '}
          <a href="/privacy" className="text-primary hover:underline">
            {t('signin.privacyLink')}
          </a>
        </p>
      </div>
    </div>
  )
}
