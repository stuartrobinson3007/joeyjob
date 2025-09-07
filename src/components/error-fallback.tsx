import { useTranslation } from '@/i18n/hooks/useTranslation'
import { isAppError } from '@/lib/utils/errors'

interface ErrorFallbackProps {
  error: Error
  reset: () => void
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <h2 className="text-2xl font-bold mb-4">{t('errors:errors.somethingWrong')}</h2>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        {isAppError(error) ? (error as { userMessage?: string }).userMessage : t('errors:errors.unexpectedError')}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
      >
        {t('errors:errors.tryAgain')}
      </button>
    </div>
  )
}
