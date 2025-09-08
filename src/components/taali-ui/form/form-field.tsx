import { ReactNode } from 'react'

import { FormFieldError } from './form-field-error'

import { Label } from '@/ui/label'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import type { Namespace } from '@/i18n/constants'
import { cn } from '@/lib/utils/utils'

interface FormFieldProps {
  name: string
  label?: string
  error?: unknown
  children: ReactNode
  required?: boolean
  className?: string
  namespace?: Namespace
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
  const { t } = useTranslation([namespace, 'common'])

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
