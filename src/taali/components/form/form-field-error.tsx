import { useFieldError } from '@/lib/errors/hooks'

interface FormFieldErrorProps {
  error?: unknown
  fieldName: string
}

export function FormFieldError({ error, fieldName }: FormFieldErrorProps) {
  const fieldError = useFieldError(error, fieldName)

  if (!fieldError) return null

  return (
    <p className="text-sm text-destructive mt-1" role="alert">
      {Array.isArray(fieldError) ? fieldError[0] : fieldError}
    </p>
  )
}
