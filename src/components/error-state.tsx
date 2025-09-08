import { AlertCircle, WifiOff, Lock, RefreshCw } from 'lucide-react'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Button } from '@/ui/button'
import type { ParsedError } from '@/lib/errors/client-handler'
import { handleErrorAction } from '@/lib/errors/client-handler'
import { isErrorCode } from '@/lib/errors/codes'

interface ErrorStateProps {
  error: ParsedError
  onRetry?: () => void
  variant?: 'full-page' | 'inline' | 'card'
  className?: string
}

export function ErrorState({ error, onRetry, variant = 'full-page', className }: ErrorStateProps) {
  const { t } = useTranslation('errors')

  // Get translated message
  const message = isErrorCode(error.code)
    ? t(`codes.${error.code}`, (error.context || {}) as Record<string, unknown>)
    : error.message

  // Get appropriate icon
  const Icon = error.code.startsWith('NET_')
    ? WifiOff
    : error.code.startsWith('AUTH_')
      ? Lock
      : AlertCircle

  // Inline variant for supporting data
  if (variant === 'inline') {
    return (
      <div className={`text-center py-4 ${className || ''}`}>
        <Icon className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <Button size="sm" variant="ghost" onClick={onRetry} className="mt-2">
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('actions.retry')}
          </Button>
        )}
      </div>
    )
  }

  // Card variant for contained errors
  if (variant === 'card') {
    return (
      <div className={`border rounded-lg p-6 text-center ${className || ''}`}>
        <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <h4 className="font-medium mb-2">{t('titles.error')}</h4>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('actions.retry')}
          </Button>
        )}
      </div>
    )
  }

  // Full-page variant (default)
  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[400px] p-8 ${className || ''}`}
    >
      <Icon className="w-12 h-12 text-muted-foreground mb-4" />

      <h3 className="text-lg font-semibold mb-2">{t('titles.error')}</h3>

      <p className="text-muted-foreground text-center max-w-md mb-6">{message}</p>

      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="default">
            <RefreshCw />
            {t('actions.retry')}
          </Button>
        )}

        {Array.isArray(error.actions) && error.actions.map((action, index) => (
          <Button
            key={index}
            onClick={() => handleErrorAction(action)}
            variant={index === 0 ? 'default' : 'outline'}
          >
            {t(`actions.${action.action}`)}
          </Button>
        ))}
      </div>
    </div>
  )
}
