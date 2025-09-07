import { useTranslation } from '@/i18n/hooks/useTranslation'

export function NotFoundComponent() {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">
        {t('errors:errors.notFound')} {t('common:messages.error')}
      </h1>
      <p className="text-muted-foreground mb-8">{t('common:app.notFound')}</p>
      <a
        href="/"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        {t('common:app.backHome')}
      </a>
    </div>
  )
}
