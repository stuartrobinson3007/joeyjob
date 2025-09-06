import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { organization, subscription, todos, member } from '@/database/schema'
import { eq, and, count } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth'
import { BILLING_PLANS } from './plans.config'

// Get current subscription
export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId
    
    // Get organization with current plan
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId))

    if (!org) {
      throw new Error('Organization not found')
    }

    // Get active subscription from Better Auth
    const [subs] = await db.select().from(subscription).where(
      and(
        eq(subscription.referenceId, orgId),
        eq(subscription.status, 'active')
      )
    ).limit(1)

    return {
      organization: org,
      subscription: subs,
      currentPlan: org.currentPlan || 'free',
      features: BILLING_PLANS[org.currentPlan as keyof typeof BILLING_PLANS]?.features,
      limits: org.planLimits || BILLING_PLANS.free.limits,
    }
  })

// Create checkout session
const createCheckoutSchema = z.object({
  plan: z.enum(['pro', 'business']),
  interval: z.enum(['monthly', 'annual']),
})

export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createCheckoutSchema.parse(data))
  .handler(async ({ data, context, request }: { data: any; context: any; request: Request }) => {
    
    const user = context.user
    const orgId = context.organizationId
    
    // Check billing permissions
    await checkPermission('billing', ['manage'], orgId)
    
    const { plan, interval } = data
    
    // Get organization
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)

    if (!org) {
      throw new Error('Organization not found')
    }

    const planConfig = BILLING_PLANS[plan]
    const priceId = planConfig.stripePriceId[interval]
    
    
    // For now, create a direct Stripe checkout session
    // This bypasses Better Auth's plugin issues
    const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-12-18.acacia'
    });
    
    const checkoutMetadata = {
      organizationId: orgId,
      plan,
      interval,
    };
    
    const result = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.BETTER_AUTH_URL || 'http://localhost:2847'}/billing?success=true`,
      cancel_url: `${process.env.BETTER_AUTH_URL || 'http://localhost:2847'}/billing`,
      metadata: checkoutMetadata,
      subscription_data: {
        metadata: checkoutMetadata,
      },
      customer_email: user.email,
    });
    
    console.log('[BILLING] Server: Direct Stripe result:', !!result.url);

    if (!result?.url) {
      throw new Error('Failed to create checkout session')
    }

    return { checkoutUrl: result.url }
  })

// Cancel subscription
export const cancelSubscription = createServerFn({ method: 'POST' })
  .handler(async ({ request }) => {
    const context = await billingAdminMiddleware({ request })
    const orgId = context.organizationId
    
    // Find active subscription
    const [activeSub] = await db.select().from(subscription).where(
      and(
        eq(subscription.referenceId, orgId),
        eq(subscription.status, 'active')
      )
    ).limit(1)

    if (!activeSub) {
      throw new Error('No active subscription found')
    }

    // Use Better Auth to cancel
    const result = await auth.api.subscription.cancel({
      body: {
        subscriptionId: activeSub.id
      },
      headers: context.headers
    })

    return { success: true }
  })

// Create billing portal session
export const createBillingPortal = createServerFn({ method: 'POST' })
  .handler(async ({ request }) => {
    const context = await billingAdminMiddleware({ request })
    const result = await auth.api.subscription.billingPortal({
      body: {
        referenceId: context.organizationId
      },
      headers: context.headers
    })

    if (!result?.data?.url) {
      throw new Error('Failed to create billing portal session')
    }

    return { portalUrl: result.data.url }
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