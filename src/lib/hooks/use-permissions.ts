/**
 * Client-side permission checking hook
 * Provides synchronous permission checks based on user's role in the active organization
 */

import { useState, useEffect, useMemo } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { useSession } from '@/lib/auth/auth-hooks'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { getRoleByName } from '@/lib/auth/roles-client'

export function usePermissions() {
  const { data: session } = useSession()
  const { activeOrganizationId } = useActiveOrganization()
  const [memberRole, setMemberRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const user = session?.user

  // Fetch the user's role in the active organization
  useEffect(() => {
    async function fetchMemberRole() {
      if (!activeOrganizationId || !user?.id) {
        setMemberRole(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await authClient.organization.listMembers({
          query: { organizationId: activeOrganizationId }
        })

        // Handle different response structures from Better Auth
        let membersArray: any[] = []
        
        if (response && 'members' in response) {
          membersArray = response.members || []
        } else if (response && 'data' in response) {
          const data = response.data
          if (Array.isArray(data)) {
            membersArray = data
          } else if (data && 'members' in data) {
            membersArray = data.members || []
          }
        } else if (Array.isArray(response)) {
          membersArray = response
        }

        // Find the current user's membership
        const currentUserMember = membersArray.find((m: any) => m.userId === user.id)
        setMemberRole(currentUserMember?.role || null)
      } catch (error) {
        console.error('Failed to fetch member role:', error)
        setMemberRole(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMemberRole()
  }, [activeOrganizationId, user?.id])

  // Create permission checking functions
  const permissions = useMemo(() => {
    const role = getRoleByName(memberRole)

    // Check specific permission using Better Auth's checkRolePermission
    const hasPermission = (resource: string, action: string | string[]): boolean => {
      if (!memberRole) return false
      
      const actions = Array.isArray(action) ? action : [action]
      
      try {
        return authClient.organization.checkRolePermission({
          role: memberRole,
          permissions: {
            [resource]: actions
          }
        })
      } catch (error) {
        console.error('Permission check failed:', error)
        return false
      }
    }

    // Todo-specific permissions
    const canCreateTodo = () => hasPermission('todos', 'create')
    const canReadTodo = () => hasPermission('todos', 'read')
    const canUpdateTodo = () => hasPermission('todos', 'update')
    const canDeleteTodo = () => hasPermission('todos', 'delete')
    const canAssignTodo = () => hasPermission('todos', 'assign')

    // Member management permissions
    const canManageMembers = () => hasPermission('member', ['create', 'update', 'delete'])
    const canInviteMembers = () => hasPermission('invitation', 'create')

    // Billing permissions
    const canViewBilling = () => hasPermission('billing', 'view')
    const canManageBilling = () => hasPermission('billing', 'manage')

    // Organization permissions
    const canUpdateOrganization = () => hasPermission('organization', 'update')
    const canDeleteOrganization = () => hasPermission('organization', 'delete')

    // Helper to check if user is admin or owner
    const isAdmin = () => memberRole === 'admin' || memberRole === 'owner'
    const isOwner = () => memberRole === 'owner'

    return {
      // Generic permission check
      hasPermission,
      
      // Todo permissions
      canCreateTodo,
      canReadTodo,
      canUpdateTodo,
      canDeleteTodo,
      canAssignTodo,
      
      // Member permissions
      canManageMembers,
      canInviteMembers,
      
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
      role: memberRole,
      isLoading
    }
  }, [memberRole])

  return permissions
}