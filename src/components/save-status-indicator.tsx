import React from 'react'
import { Loader2, CheckCircle, AlertCircle, CloudCheck, AlertTriangle, CloudAlert } from 'lucide-react'

import { Badge } from '@/ui/badge'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { ValidationResult } from '@/features/booking/components/form-editor/utils/form-validation'

interface SaveStatusIndicatorProps {
  isSaving: boolean
  lastSaved: Date | null
  isDirty: boolean
  errors?: string[]
  className?: string
  // New validation-specific props
  validationResult?: ValidationResult | null
  canSave?: boolean
  saveBlockedReason?: string
  isFormEnabled?: boolean
}

export function SaveStatusIndicator({
  isSaving,
  lastSaved,
  isDirty,
  errors = [],
  className,
  validationResult,
  canSave = true,
  saveBlockedReason,
  isFormEnabled = false,
}: SaveStatusIndicatorProps) {
  const { t } = useTranslation('common')

  // Show "Resolve Issues" for enabled forms with validation errors
  if (isFormEnabled && validationResult && !validationResult.isValid && isDirty) {
    return (
      <CloudAlert className="size-5 text-warning" aria-label="Resolve issues to save changes" />
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
