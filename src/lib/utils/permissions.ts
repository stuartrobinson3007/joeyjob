import { getWebRequest } from '@tanstack/react-start/server'
import { auth, roles } from '@/lib/auth/auth'
import { PermissionError } from './errors'
import { db } from '@/lib/db/db'
import { member } from '@/database/schema'
import { and, eq } from 'drizzle-orm'

/**
 * Check if the current user has specific permissions for a resource
 * @param resource - The resource to check permissions for (e.g., 'billing', 'todos')
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

    if (!hasPermission.success) {
      const defaultMessage = `You don't have permission to ${actions.join('/')} ${resource}`
      throw new PermissionError(customMessage || defaultMessage)
    }
  } catch (error) {
    throw error
  }
}

/**
 * Verify that a user has billing admin permissions in an organization
 * @param userId - The user ID to check
 * @param organizationId - The organization to check permissions for
 * @throws PermissionError if user lacks billing admin permissions
 */
export const requireBillingAdmin = async (
  userId: string,
  organizationId: string
): Promise<void> => {
  const memberRecord = await db.query.member.findFirst({
    where: and(
      eq(member.userId, userId),
      eq(member.organizationId, organizationId)
    )
  })

  if (!memberRecord) {
    throw new PermissionError('Not a member of this organization')
  }

  const role = roles[memberRecord.role as keyof typeof roles]
  if (!role?.hasPermission('billing', 'manage')) {
    throw new PermissionError('Billing admin permission required')
  }
}