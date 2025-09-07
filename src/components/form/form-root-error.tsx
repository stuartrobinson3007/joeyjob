import { AlertCircle } from 'lucide-react'
import { FieldErrors } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/taali-ui/ui/alert'

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
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {errors.root.message}
      </AlertDescription>
    </Alert>
  )
}