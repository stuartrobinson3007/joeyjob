import { count, eq, isNull, and } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { member, todos, invitation, organization } from '@/database/schema'
import { BILLING_PLANS } from '@/features/billing/lib/plans.config'

export type PlanLimitResource = 'todos' | 'members' | 'storage'
export type PlanLimitAction = 'create' | 'update'

export interface PlanLimitResult {
  allowed: boolean
  reason?: string
  usage?: {
    used: number
    limit: number
    percentage: number
  }
}

/**
 * Utility function to check plan limits for an organization using Better Auth's subscription API
 * This can be called from server functions, unlike the checkPlanLimit server function
 */
export async function checkPlanLimitUtil(
  resource: PlanLimitResource,
  action: PlanLimitAction,
  organizationId: string,
  headers?: HeadersInit
): Promise<PlanLimitResult> {
  // Get active subscriptions for the organization using Better Auth
  let limits = BILLING_PLANS.free.limits // Default to free plan
  
  try {
    const subscriptions = await auth.api.listActiveSubscriptions({
      query: { referenceId: organizationId },
      headers: headers,
    })

    // Find the active subscription
    const activeSubscription = subscriptions.find(
      sub => sub.status === 'active' || sub.status === 'trialing'
    )

    // Get limits from subscription or fall back to free plan
    limits = (activeSubscription?.limits || BILLING_PLANS.free.limits) as typeof BILLING_PLANS.free.limits
  } catch (_error) {
    // If there's an error fetching subscriptions, try to use organization's currentPlan
    try {
      const [org] = await db
        .select({ currentPlan: organization.currentPlan })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1)
      
      if (org?.currentPlan) {
        const planConfig = BILLING_PLANS[org.currentPlan as keyof typeof BILLING_PLANS]
        if (planConfig) {
          limits = planConfig.limits as typeof BILLING_PLANS.free.limits
        }
      }
    } catch (_dbError) {
      // Use free plan as fallback
    }
  }

  // If limit is -1, it means unlimited
  const resourceLimit = limits[resource] as number
  if (resourceLimit === -1) {
    return { allowed: true }
  }

  // Get current usage based on resource type
  let currentUsage = 0
  try {
    switch (resource) {
      case 'todos': {
        const result = await db
          .select({ count: count(todos.id) })
          .from(todos)
          .where(and(eq(todos.organizationId, organizationId), isNull(todos.deletedAt)))
        currentUsage = result[0]?.count || 0
        break
      }
      case 'members': {
        // Count both active members and pending invitations for plan limits
        const [memberCount, invitationCount] = await Promise.all([
          db.select({ count: count(member.id) })
            .from(member)
            .where(eq(member.organizationId, organizationId)),
          db.select({ count: count(invitation.id) })
            .from(invitation)
            .where(and(eq(invitation.organizationId, organizationId), eq(invitation.status, 'pending')))
        ])
        
        const activeMembers = memberCount[0]?.count || 0
        const pendingInvitations = invitationCount[0]?.count || 0
        currentUsage = activeMembers + pendingInvitations
        break
      }
      case 'storage': {
        // For now, we don't track storage usage - return allowed
        return { allowed: true }
      }
    }
  } catch (_error) {
    // On error counting usage, deny the action for safety
    return { allowed: false, reason: 'Unable to verify usage' }
  }

  // Check if adding one more would exceed the limit
  const wouldExceedLimit = action === 'create' && currentUsage >= resourceLimit
  
  const usage = {
    used: currentUsage,
    limit: resourceLimit,
    percentage: resourceLimit > 0 ? Math.round((currentUsage / resourceLimit) * 100) : 0,
  }

  if (wouldExceedLimit) {
    return {
      allowed: false,
      reason: `Your current plan allows ${resourceLimit} ${resource}. You currently have ${currentUsage}.`,
      usage,
    }
  }

  return { allowed: true, usage }
}

/**
 * Get current usage statistics for an organization
 */
export async function getOrganizationUsage(organizationId: string, headers?: HeadersInit) {
  // Get limits from Better Auth subscription API
  let limits = BILLING_PLANS.free.limits // Default to free plan
  
  try {
    // Get active subscriptions for the organization using Better Auth
    const subscriptions = await auth.api.listActiveSubscriptions({
      query: { referenceId: organizationId },
      headers: headers,
    })

    // Find the active subscription
    const activeSubscription = subscriptions.find(
      sub => sub.status === 'active' || sub.status === 'trialing'
    )

    // Get limits from subscription or fall back to free plan
    limits = (activeSubscription?.limits || BILLING_PLANS.free.limits) as typeof BILLING_PLANS.free.limits
  } catch (_error) {
    // Use free plan limits as fallback
  }

  try {
    // Get current usage
    const [todoResult, memberResult, invitationResult] = await Promise.all([
      db
        .select({ count: count(todos.id) })
        .from(todos)
        .where(and(eq(todos.organizationId, organizationId), isNull(todos.deletedAt))),
      db
        .select({ count: count(member.id) })
        .from(member)
        .where(eq(member.organizationId, organizationId)),
      db
        .select({ count: count(invitation.id) })
        .from(invitation)
        .where(and(eq(invitation.organizationId, organizationId), eq(invitation.status, 'pending')))
    ])

    const todoCount = todoResult[0]?.count || 0
    const activeMembers = memberResult[0]?.count || 0
    const pendingInvitations = invitationResult[0]?.count || 0
    const memberCount = activeMembers + pendingInvitations

    return {
      todos: {
        used: todoCount,
        limit: limits.todos as number,
        percentage:
          (limits.todos as number) === -1
            ? 0
            : Math.round((todoCount / Math.max(limits.todos as number, 1)) * 100),
      },
      members: {
        used: memberCount,
        limit: limits.members as number,
        percentage:
          (limits.members as number) === -1
            ? 0
            : Math.round((memberCount / Math.max(limits.members as number, 1)) * 100),
      },
      storage: {
        used: 0, // Not implemented yet
        limit: limits.storage as number,
        percentage: 0,
      },
    }
  } catch (_error) {
    // Return zeros with limits on error
    return {
      todos: { used: 0, limit: limits.todos as number, percentage: 0 },
      members: { used: 0, limit: limits.members as number, percentage: 0 },
      storage: { used: 0, limit: limits.storage as number, percentage: 0 },
    }
  }
}