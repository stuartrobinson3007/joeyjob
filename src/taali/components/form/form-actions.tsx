import { Loader2 } from 'lucide-react'

import { Button } from '@/ui/button'
import { useTranslation } from '@/i18n/hooks/useTranslation'

interface FormActionsProps {
  isSubmitting?: boolean
  isDirty?: boolean
  submitLabel?: string
  cancelLabel?: string
  onCancel?: () => void
  showCancel?: boolean
  className?: string
}

/**
 * Standard form action buttons (Submit/Cancel)
 * 
 * Features:
 * - Loading state for submit button
 * - Disabled when form is not dirty or is submitting
 * - Optional cancel button
 * - Customizable labels
 */
export function FormActions({
  isSubmitting = false,
  isDirty = false,
  submitLabel,
  cancelLabel,
  onCancel,
  showCancel = true,
  className = ''
}: FormActionsProps) {
  const { t } = useTranslation('common')
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Button
        type="submit"
        disabled={isSubmitting || !isDirty}
      >
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? t('states.saving') : (submitLabel || t('states.saveChanges'))}
      </Button>

      {showCancel && onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {cancelLabel || t('actions.cancel')}
        </Button>
      )}
    </div>
  )
}