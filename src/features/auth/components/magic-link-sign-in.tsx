import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'

import { authClient } from '@/lib/auth/auth-client'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/lib/errors/codes'

export function MagicLinkSignIn() {
  const { t } = useTranslation('auth')
  const { showError, showSuccess } = useErrorHandler()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      showError(new AppError(ERROR_CODES.VAL_REQUIRED_FIELD, 400, { field: t('common:labels.email') }))
      return
    }

    setIsLoading(true)
    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: '/',
      })

      if (result.error) {
        showError(
          new AppError(
            ERROR_CODES.SYS_SERVER_ERROR,
            500,
            undefined,
            result.error.message || t('errors:errors.magicLinkFailed')
          )
        )
      } else {
        setIsSent(true)
        showSuccess(t('magicLink.sent'))
      }
    } catch (error) {
      showError(error)
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
          <h3 className="text-lg font-medium text-green-900">{t('magicLink.sent')}</h3>
          <p className="text-sm text-green-700 mt-1">{t('magicLink.check')}</p>
          <p className="text-xs text-green-600 mt-2">{t('magicLink.expire')}</p>
        </div>
        <button
          onClick={() => {
            setIsSent(false)
            setEmail('')
          }}
          className="text-sm text-primary hover:text-primary/80"
        >
          {t('magicLink.resend')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
          {t('common:labels.email')}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t('signin.emailPlaceholder')}
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
            {t('states.sending')}
          </>
        ) : (
          <>
            <Mail />
            {t('signin.providers.magicLink')}
          </>
        )}
      </button>
    </form>
  )
}
