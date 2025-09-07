/**
 * Client-side role configuration for permission checking
 * These match the server-side roles defined in auth.ts
 */

import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/organization/access'

// Use the same statements as the server
const statement = {
  ...defaultStatements,
  todos: ['create', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'],
  invitation: ['create', 'delete', 'cancel'], // Add cancel permission for Better Auth compatibility
} as const

// Create access control instance
const ac = createAccessControl(statement)

// Define roles with specific permissions - matching server exactly
export const viewer = ac.newRole({
  billing: ['view'],
})

export const member = ac.newRole({
  todos: ['create', 'update', 'delete'],
  billing: ['view'],
})

export const admin = ac.newRole({
  organization: ['update'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'delete', 'cancel'],
  todos: ['create', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'],
})

export const owner = ac.newRole({
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'delete', 'cancel'],
  todos: ['create', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'],
})

// Export roles object for easy access
export const roles = {
  viewer,
  member,
  admin,
  owner,
} as const

// Helper function to get role by name
export function getRoleByName(roleName: string | null) {
  if (!roleName) return null
  return roles[roleName as keyof typeof roles] || null
}
