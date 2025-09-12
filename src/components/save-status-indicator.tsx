import { Loader2, CheckCircle, AlertCircle, CloudCheck } from 'lucide-react'

import { Badge } from '@/ui/badge'
import { useTranslation } from '@/i18n/hooks/useTranslation'

interface SaveStatusIndicatorProps {
  isSaving: boolean
  lastSaved: Date | null
  isDirty: boolean
  errors?: string[]
  className?: string
}

export function SaveStatusIndicator({
  isSaving,
  lastSaved,
  isDirty,
  errors = [],
  className,
}: SaveStatusIndicatorProps) {
  const { t } = useTranslation('common')
  // Show errors if any
  if (errors.length > 0) {
    return (
      <Badge
        variant="destructive"
        appearance="soft"
        startIcon={<AlertCircle className="h-3 w-3" />}
        className={className}
      >
        {errors[0]}
      </Badge>
    )
  }

  // Show saving state
  if (isSaving) {
    return (
      // <Badge
      //   variant="muted"
      //   appearance="soft"
      //   startIcon={<Loader2 className="h-3 w-3 animate-spin" />}
      //   className={className}
      // >
      //   {t('states.savingChanges')}
      // </Badge>
      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={t('states.savingChanges')} />
    )
  }

  // Show saved state
  if (lastSaved && !isDirty) {
    return (
      // <Badge
      //   variant="success"
      //   appearance="soft"
      //   status
      //   className={className}
      // >
      //   {t('states.changesSaved')}
      // </Badge>
      <CloudCheck className="size-5 text-success" aria-label={t('states.changesSaved')} />
    )
  }

  // Show unsaved changes
  if (isDirty) {
    return (
      // <Badge variant="warning" appearance="soft" status className={className}>
      //   {t('states.unsavedChanges')}
      // </Badge>
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label={t('states.savingChanges')} />
    )
  }

  // No indicator when no changes or not saved yet
  return null
}
