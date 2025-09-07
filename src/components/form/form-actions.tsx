import { Loader2 } from 'lucide-react'

import { Button } from '@/components/taali-ui/ui/button'

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
  submitLabel = 'Save Changes',
  cancelLabel = 'Cancel',
  onCancel,
  showCancel = true,
  className = ''
}: FormActionsProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Button 
        type="submit" 
        disabled={isSubmitting || !isDirty}
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Saving...' : submitLabel}
      </Button>
      
      {showCancel && onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {cancelLabel}
        </Button>
      )}
    </div>
  )
}