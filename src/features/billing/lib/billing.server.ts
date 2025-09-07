import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { organization, subscription, todos, member } from '@/database/schema'
import { eq, count, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth'
import { BILLING_PLANS } from './plans.config'

// Get current subscription using BetterAuth API
export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId!  // organizationMiddleware ensures this exists
    console.log('[BILLING SERVER] getSubscription called for org:', orgId)
    
    // Get organization with current plan
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId))
    console.log('[BILLING SERVER] Organization found:', !!org, 'Plan:', org?.currentPlan, 'StripeCustomerId:', org?.stripeCustomerId)

    if (!org) {
      throw new Error('Organization not found')
    }

    // Use BetterAuth's API to list subscriptions
    let activeSubscription: any = null
    let allSubscriptions: any[] = []
    
    try {
      const subscriptions = await auth.api.listActiveSubscriptions({
        query: {
          referenceId: orgId
        },
        headers: context.headers
      })
      
      console.log('[BILLING SERVER] BetterAuth subscriptions found:', subscriptions?.length || 0)
      
      if (subscriptions && subscriptions.length > 0) {
        allSubscriptions = subscriptions
        // Find the most relevant subscription
        activeSubscription = subscriptions.find(
          sub => sub.status === 'active' || sub.status === 'trialing'
        ) || subscriptions[0] // Fall back to most recent if none active
        
        console.log('[BILLING SERVER] Active subscription:', {
          id: activeSubscription?.id,
          status: activeSubscription?.status,
          plan: activeSubscription?.plan
        })
      }
    } catch (error) {
      console.error('[BILLING SERVER] Error fetching subscriptions:', error)
      // Continue without subscription data rather than failing entirely
    }

    const result = {
      organization: org,
      subscription: activeSubscription,
      allSubscriptions,
      currentPlan: activeSubscription?.plan || org.currentPlan || 'free',
      features: BILLING_PLANS[org.currentPlan as keyof typeof BILLING_PLANS]?.features,
      limits: activeSubscription?.limits || org.planLimits || BILLING_PLANS.free.limits,
      hasStripeCustomer: !!org.stripeCustomerId || !!activeSubscription?.stripeCustomerId || allSubscriptions.length > 0,
    }
    
    console.log('[BILLING SERVER] Returning:', {
      currentPlan: result.currentPlan,
      hasStripeCustomer: result.hasStripeCustomer,
      hasSubscription: !!activeSubscription
    })
    
    return result
  })

// Create checkout session using BetterAuth
const createCheckoutSchema = z.object({
  plan: z.enum(['pro', 'business']),
  interval: z.enum(['monthly', 'annual']),
})

export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createCheckoutSchema.parse(data))
  .handler(async ({ data, context }) => {
    
    const orgId = context.organizationId!  // organizationMiddleware ensures this exists
    
    // Check billing permissions
    await checkPermission('billing', ['manage'], orgId)
    
    const { plan, interval } = data
    
    console.log('[BILLING] Creating checkout for:', { plan, interval, orgId })
    
    try {
      // Use BetterAuth's subscription upgrade API
      const result = await auth.api.upgradeSubscription({
        body: {
          plan,
          successUrl: `${process.env.BETTER_AUTH_URL || 'http://localhost:2847'}/billing?success=true`,
          cancelUrl: `${process.env.BETTER_AUTH_URL || 'http://localhost:2847'}/billing`,
          annual: interval === 'annual',
          referenceId: orgId,
        },
        headers: context.headers
      })
      
      console.log('[BILLING] BetterAuth upgrade result:', !!result)
      
      if (!result?.url) {
        throw new Error('Failed to create checkout session - no URL returned')
      }
      
      return { checkoutUrl: result.url }
    } catch (error) {
      console.error('[BILLING] Checkout creation error:', error)
      throw new Error(`Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })


// Create billing portal session
export const createBillingPortal = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId!  // organizationMiddleware ensures this exists
    
    // Check billing permissions
    await checkPermission('billing', ['manage'], orgId)
    
    console.log('[BILLING] createBillingPortal - Organization:', orgId)
    
    // Get organization to check for stripeCustomerId
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)
    
    if (!org) {
      throw new Error('Organization not found')
    }
    
    // Try to create portal session
    // BetterAuth's billingPortal should work if there's a customer associated
    try {
      const result = await auth.api.subscription.billingPortal({
        body: {
          referenceId: orgId
        },
        headers: context.headers
      })

      if (!result?.data?.url) {
        console.error('[BILLING] Portal creation failed - no URL returned')
        throw new Error('Failed to create billing portal session')
      }

      return { portalUrl: result.data.url }
    } catch (error) {
      console.error('[BILLING] Portal creation error:', error)
      // If no customer exists, we need to handle this differently
      if (org.stripeCustomerId) {
        // Customer exists but portal failed - this is a real error
        throw error
      } else {
        // No customer yet - they need to subscribe first
        throw new Error('No billing history available. Please subscribe to a plan first.')
      }
    }
  })

// Get usage statistics
export const getUsageStats = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId
    
    // Get organization with limits
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)

    // Count todos
    const todoCount = await db
      .select({ count: count() })
      .from(todos)
      .where(eq(todos.organizationId, orgId))

    // Count members
    const memberCount = await db
      .select({ count: count() })
      .from(member)
      .where(eq(member.organizationId, orgId))

    const limits = org?.planLimits || BILLING_PLANS.free.limits

    return {
      usage: {
        todos: {
          used: todoCount[0]?.count || 0,
          limit: limits.todos,
          percentage: limits.todos === -1 ? 0 : 
            Math.round(((todoCount[0]?.count || 0) / limits.todos) * 100)
        },
        members: {
          used: memberCount[0]?.count || 0,
          limit: limits.members,
          percentage: limits.members === -1 ? 0 :
            Math.round(((memberCount[0]?.count || 0) / limits.members) * 100)
        },
        storage: {
          used: 0, // Implement storage tracking
          limit: limits.storage,
          percentage: 0
        }
      }
    }
  })

// Check if action is allowed based on plan limits
export const checkPlanLimit = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(z.object({ 
    resource: z.enum(['todos', 'members', 'storage']),
    action: z.enum(['create', 'update'])
  }).parse)
  .handler(async ({ data, context }) => {
    // Get usage stats for the organization  
    const orgId = context.organizationId
    
    // Get organization with limits
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)

    // Count todos
    const todoCount = await db
      .select({ count: count() })
      .from(todos)
      .where(eq(todos.organizationId, orgId))

    // Count members  
    const memberCount = await db
      .select({ count: count() })
      .from(member)
      .where(eq(member.organizationId, orgId))

    const limits = org?.planLimits || BILLING_PLANS.free.limits
    
    const usage = {
      todos: {
        used: todoCount[0]?.count || 0,
        limit: limits.todos,
        percentage: limits.todos === -1 ? 0 : 
          Math.round(((todoCount[0]?.count || 0) / limits.todos) * 100)
      },
      members: {
        used: memberCount[0]?.count || 0,
        limit: limits.members,
        percentage: limits.members === -1 ? 0 :
          Math.round(((memberCount[0]?.count || 0) / limits.members) * 100)
      },
      storage: {
        used: 0,
        limit: limits.storage,
        percentage: 0
      }
    }
    
    const resourceUsage = usage[data.resource]
    
    if (resourceUsage.limit === -1) {
      return { allowed: true }
    }

    if (data.action === 'create') {
      return { 
        allowed: resourceUsage.used < resourceUsage.limit,
        reason: resourceUsage.used >= resourceUsage.limit 
          ? `You've reached your plan limit of ${resourceUsage.limit} ${data.resource}`
          : undefined
      }
    }

    return { allowed: true }
  })