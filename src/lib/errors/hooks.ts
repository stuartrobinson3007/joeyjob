import { useMemo, useCallback } from 'react'
import { toast } from 'sonner'

import { parseError, handleErrorAction } from './client-handler'
import { isErrorCode } from './codes'
import type { ParsedError } from './client-handler'

import { useTranslation } from '@/i18n/hooks/useTranslation'

// Hook to translate and handle errors
export function useErrorHandler() {
  const { t } = useTranslation('errors')

  const translateError = useCallback(
    (error: ParsedError): string => {
      // If we have a valid error code, translate it
      if (isErrorCode(error.code)) {
        return t(`codes.${error.code}`, error.context || {})
      }

      // Otherwise use the message as-is
      return error.message
    },
    [t]
  )

  const showError = useCallback(
    (
      error: unknown,
      options?: {
        fallbackMessage?: string
        silent?: boolean
      }
    ) => {
      const parsed = parseError(error)
      const message = options?.fallbackMessage || translateError(parsed)

      if (!options?.silent) {
        // Show toast with action if available
        if (parsed.actions && parsed.actions.length > 0) {
          const primaryAction = parsed.actions[0]
          toast.error(message, {
            action: {
              label: t(`actions.${primaryAction.action}`),
              onClick: () => handleErrorAction(primaryAction),
            },
            duration: 5000,
          })
        } else {
          toast.error(message)
        }
      }

      return parsed
    },
    [t, translateError]
  )

  const showSuccess = useCallback(
    (message: string) => {
      // Check if it's a translation key
      const translatedMessage = message.includes('.') ? t(message) : message
      toast.success(translatedMessage)
    },
    [t]
  )

  return {
    translateError,
    showError,
    showSuccess,
    parseError,
  }
}

// Hook for form field errors
export function useFieldError(error: unknown, fieldName: string) {
  const { t } = useTranslation('validation')

  return useMemo(() => {
    const parsed = parseError(error)

    if (parsed.code === 'VAL_INVALID_FORMAT' && parsed.context?.fields) {
      const fieldError = parsed.context.fields[fieldName]
      if (fieldError) {
        // Translate if it looks like a key
        if (typeof fieldError === 'string' && fieldError.includes('.')) {
          return t(fieldError)
        }
        return fieldError
      }
    }

    return undefined
  }, [error, fieldName, t])
}
