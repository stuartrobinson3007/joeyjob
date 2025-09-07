import { ReactNode } from 'react'

import { FormFieldError } from './form-field-error'

import { Label } from '@/components/taali-ui/ui/label'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { cn } from '@/lib/utils/utils'

interface FormFieldProps {
  name: string
  label?: string
  error?: unknown
  children: ReactNode
  required?: boolean
  className?: string
  namespace?: string
}

export function FormField({
  name,
  label,
  error,
  children,
  required,
  className,
  namespace = 'common',
}: FormFieldProps) {
  const { t } = useTranslation([namespace as any, 'common'] as const)

  const translatedLabel = label || t(`fields.${name}`, { defaultValue: name })

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name}>
        {translatedLabel}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div>{children}</div>
      <FormFieldError error={error} fieldName={name} />
    </div>
  )
}
