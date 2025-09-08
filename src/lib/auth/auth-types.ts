/**
 * BetterAuth Type Helpers
 * 
 * Provides type-safe helpers using BetterAuth's $Infer system
 * instead of manual type casting throughout the application.
 */

// Use BetterAuth's actual Subscription type from the Stripe plugin
import type { Subscription } from '@better-auth/stripe'

import type { getSubscription } from '../../features/billing/lib/billing.server'

import type { auth } from './auth'
// Get the return type of your getSubscription function (best approach)  

// Infer proper types from BetterAuth configuration  
export type BetterAuthSession = typeof auth.$Infer.Session
export type BetterAuthUser = BetterAuthSession['user']

// Organization role types from your existing role definitions
export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'

// Valid organization roles array for runtime validation  
const VALID_ORG_ROLES: OrganizationRole[] = ['owner', 'admin', 'member', 'viewer']

/**
 * Type-safe organization role validation
 * Uses your existing BetterAuth role definitions
 */
export function validateOrganizationRole(role: unknown): OrganizationRole {
  return VALID_ORG_ROLES.includes(role as OrganizationRole) 
    ? (role as OrganizationRole) 
    : 'member' // default fallback
}

/**
 * Check if a value is a valid organization role
 */
export function isValidOrganizationRole(role: unknown): role is OrganizationRole {
  return typeof role === 'string' && VALID_ORG_ROLES.includes(role as OrganizationRole)
}

// User role types (for system-level roles like superadmin)
export type SystemRole = 'user' | 'admin' | 'superadmin'

const VALID_SYSTEM_ROLES: SystemRole[] = ['user', 'admin', 'superadmin']

/**
 * Type-safe system role validation 
 */
export function validateSystemRole(role: unknown): SystemRole {
  return VALID_SYSTEM_ROLES.includes(role as SystemRole) 
    ? (role as SystemRole) 
    : 'user' // default fallback
}

/**
 * Check if a value is a valid system role
 */
export function isValidSystemRole(role: unknown): role is SystemRole {
  return typeof role === 'string' && VALID_SYSTEM_ROLES.includes(role as SystemRole)
}

/**
 * Type-safe session property access
 * Uses proper BetterAuth inferred types
 */
export function getSessionProperty<K extends keyof BetterAuthSession>(
  session: unknown,
  property: K
): BetterAuthSession[K] | undefined {
  if (!session || typeof session !== 'object' || session === null) {
    return undefined
  }
  
  return (session as BetterAuthSession)[property]
}

/**
 * Check if user is impersonating (type-safe)
 */
export function isUserImpersonating(session: unknown): boolean {
  const sessionData = getSessionProperty(session, 'session')
  return !!(sessionData as { impersonatedBy?: string | null })?.impersonatedBy
}

/**
 * Role hierarchy for sorting (matches your BetterAuth role definitions)
 */
export const ROLE_ORDER: Record<OrganizationRole, number> = {
  owner: 0,
  admin: 1, 
  member: 2,
  viewer: 3,
} as const

/**
 * Get numeric role order for sorting
 */
export function getRoleOrder(role: unknown): number {
  const validRole = validateOrganizationRole(role)
  return ROLE_ORDER[validRole]
}

// Extend BetterAuth's Subscription with Stripe-specific properties your server adds
export type BetterAuthSubscription = Subscription & {
  stripeCancelAtPeriodEnd?: boolean
  stripeCurrentPeriodEnd?: string
}

export type SubscriptionResponse = Awaited<ReturnType<typeof getSubscription>>

/**
 * Type guard for subscription response (using inferred type)
 */
export function isSubscriptionResponse(data: unknown): data is SubscriptionResponse {
  return (
    data !== null &&
    typeof data === 'object' &&
    'currentPlan' in data &&
    'hasStripeCustomer' in data
  )
}