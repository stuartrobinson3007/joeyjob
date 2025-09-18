import { getWebRequest } from '@tanstack/react-start/server'

import { PermissionError } from '../../taali/utils/errors'

import { auth } from '@/lib/auth/auth'

/**
 * Check if the current user has specific permissions for a resource
 * @param resource - The resource to check permissions for (e.g., 'billing', 'members')
 * @param actions - Array of actions to check (e.g., ['view', 'manage'])
 * @param organizationId - The organization context for the permission check
 * @param customMessage - Optional custom error message if permission is denied
 */
export const checkPermission = async (
  resource: string,
  actions: string[],
  organizationId: string,
  customMessage?: string
) => {
  const request = getWebRequest()

  const hasPermission = await auth.api.hasPermission({
    headers: request.headers,
    body: {
      organizationId,
      permissions: {
        [resource]: actions,
      },
    },
  })

  if (!hasPermission.success) {
    const defaultMessage = `You don't have permission to ${actions.join('/')} ${resource}`
    throw new PermissionError(customMessage || defaultMessage)
  }
}

