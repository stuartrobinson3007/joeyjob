import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/components/taali-ui/lib/utils'
import { Badge } from '@/components/taali-ui/ui/badge'

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
  className
}: SaveStatusIndicatorProps) {
  // Show errors if any
  if (errors.length > 0) {
    return (
      <Badge 
        variant="destructive" 
        style="soft" 
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
      <Badge 
        variant="muted" 
        style="soft" 
        startIcon={<Loader2 className="h-3 w-3 animate-spin" />}
        className={className}
      >
        Saving changes
      </Badge>
    )
  }

  // Show saved state
  if (lastSaved && !isDirty) {
    return (
      <Badge 
        variant="success" 
        style="soft" 
        startIcon={<CheckCircle className="h-3 w-3" />}
        className={className}
      >
        Changes saved
      </Badge>
    )
  }

  // Show unsaved changes
  if (isDirty) {
    return (
      <Badge 
        variant="warning" 
        style="soft" 
        status
        className={className}
      >
        Unsaved changes
      </Badge>
    )
  }

  // No indicator when no changes or not saved yet
  return null
}