import { AlertCircle } from 'lucide-react'
import { FieldErrors } from 'react-hook-form'

import { Alert, AlertDescription } from '@/ui/alert'

interface FormRootErrorProps {
  errors?: FieldErrors
  className?: string
}

/**
 * Component to display root-level form errors
 * 
 * Features:
 * - Shows errors that aren't tied to specific fields
 * - Consistent error styling
 * - Only renders when there's a root error
 */
export function FormRootError({ errors, className = '' }: FormRootErrorProps) {
  if (!errors?.root?.message) {
    return null
  }

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle />
      <AlertDescription>
        {errors.root.message}
      </AlertDescription>
    </Alert>
  )
}