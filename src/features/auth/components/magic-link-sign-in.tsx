import { useState } from 'react'
import { Mail } from 'lucide-react'

import { authClient } from '@/lib/auth/auth-client'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

export function MagicLinkSignIn() {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const { showError, showSuccess } = useErrorHandler()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      showError(new AppError(ERROR_CODES.VAL_REQUIRED_FIELD, 400, { field: tCommon('labels.email') }))
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
            result.error.message || t('errors.magicLinkFailed')
          )
        )
      } else {
        setIsSent(true)
        showSuccess(t('magicLink.sent'))
      }
    } catch (error) {
      showError(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
          <Mail className="w-12 h-12 text-success mx-auto mb-2" />
          <h3 className="text-lg font-medium text-success">{t('magicLink.sent')}</h3>
          <p className="text-sm text-success/80 mt-1">{t('magicLink.check')}</p>
          <p className="text-xs text-success/60 mt-2">{t('magicLink.expire')}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsSent(false)
            setEmail('')
          }}
        >
          {t('magicLink.resend')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">
          {tCommon('labels.email')}
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t('signin.emailPlaceholder')}
          disabled={isLoading}
          required
        />
      </div>
      <Button
        type="submit"
        loading={isLoading}
        className="w-full"
      >
        {isLoading ? (
          t('states.sending')
        ) : (
          <>
            <Mail />
            {t('signin.providers.magicLink')}
          </>
        )}
      </Button>
    </form>
  )
}
