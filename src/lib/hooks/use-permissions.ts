/**
 * Client-side permission checking hook
 * Simplified for single-user organizations - all users are owners of their org
 */

import { useMemo } from 'react'

import { useSession } from '@/lib/auth/auth-hooks'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'

export function useClientPermissions() {
  const { data: session } = useSession()
  const { activeOrganizationId } = useActiveOrganization()

  const user = session?.user

  // Create simplified permission functions
  // In single-user mode, users have full permissions for their own organization
  const permissions = useMemo(() => {
    const isAuthenticated = !!user && !!activeOrganizationId

    // All permissions return true for authenticated users in their own org
    const hasPermission = (_resource: string, _action: string | string[]): boolean => {
      return isAuthenticated
    }

    // Todo permissions - all allowed
    const canCreateTodo = () => isAuthenticated
    const canReadTodo = () => isAuthenticated
    const canUpdateTodo = () => isAuthenticated
    const canDeleteTodo = () => isAuthenticated
    const canAssignTodo = () => isAuthenticated

    // Member management permissions - disabled in single-user mode
    const canManageMembers = () => false
    const canInviteMembers = () => false
    const canCancelInvitations = () => false

    // Billing permissions - all allowed
    const canViewBilling = () => isAuthenticated
    const canManageBilling = () => isAuthenticated

    // Organization permissions - all allowed
    const canUpdateOrganization = () => isAuthenticated
    const canDeleteOrganization = () => isAuthenticated

    // Role checks - all users are owners
    const isAdmin = () => isAuthenticated
    const isOwner = () => isAuthenticated

    return {
      // Generic permission check
      hasPermission,

      // Todo permissions
      canCreateTodo,
      canReadTodo,
      canUpdateTodo,
      canDeleteTodo,
      canAssignTodo,

      // Member permissions (disabled)
      canManageMembers,
      canInviteMembers,
      canCancelInvitations,

      // Billing permissions
      canViewBilling,
      canManageBilling,

      // Organization permissions
      canUpdateOrganization,
      canDeleteOrganization,

      // Role checks
      isAdmin,
      isOwner,

      // Raw data
      role: isAuthenticated ? 'owner' : null,
      isLoading: false,
    }
  }, [user, activeOrganizationId])

  return permissions
}
