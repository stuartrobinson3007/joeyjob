import { AlertCircle, WifiOff, Lock, RefreshCw } from 'lucide-react'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Button } from '@/components/taali-ui/ui/button'
import type { ParsedError } from '@/lib/errors/client-handler'
import { handleErrorAction } from '@/lib/errors/client-handler'
import { isErrorCode } from '@/lib/errors/codes'

interface ErrorStateProps {
  error: ParsedError
  onRetry?: () => void
  className?: string
}

export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation('errors')

  // Get translated message
  const message = isErrorCode(error.code)
    ? t(`codes.${error.code}`, error.context || {})
    : error.message

  // Get appropriate icon
  const Icon = error.code.startsWith('NET_')
    ? WifiOff
    : error.code.startsWith('AUTH_')
      ? Lock
      : AlertCircle

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[400px] p-8 ${className || ''}`}
    >
      <Icon className="w-12 h-12 text-muted-foreground mb-4" />

      <h3 className="text-lg font-semibold mb-2">{t('common:titles.error')}</h3>

      <p className="text-muted-foreground text-center max-w-md mb-6">{message}</p>

      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="default">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('common:actions.retry')}
          </Button>
        )}

        {error.actions?.map((action, index) => (
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
