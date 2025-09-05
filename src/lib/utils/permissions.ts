import { getWebRequest } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth/auth'
import { PermissionError } from './errors'

export const checkPermission = async (
  resource: string,
  actions: string[],
  organizationId: string,
  customMessage?: string
) => {
  console.log('[CHECK_PERMISSION] Starting permission check:', {
    resource,
    actions,
    organizationId,
    customMessage
  })

  const request = getWebRequest()
  console.log('[CHECK_PERMISSION] Got web request, headers present:', {
    hasHeaders: !!request.headers,
    headersCount: Object.keys(request.headers).length
  })

  console.log('[CHECK_PERMISSION] About to call auth.api.hasPermission with organizationId')

  try {
    const hasPermission = await auth.api.hasPermission({
      headers: request.headers,
      body: {
        organizationId,
        permissions: {
          [resource]: actions
        }
      }
    })

    console.log('[CHECK_PERMISSION] auth.api.hasPermission result:', hasPermission)

    if (!hasPermission.success) {
      const defaultMessage = `You don't have permission to ${actions.join('/')} ${resource}`
      console.log('[CHECK_PERMISSION] Permission denied, throwing error:', customMessage || defaultMessage)
      throw new PermissionError(customMessage || defaultMessage)
    }

    console.log('[CHECK_PERMISSION] Permission check successful')
  } catch (error) {
    console.error('[CHECK_PERMISSION] Error during permission check:', error)
    throw error
  }
}