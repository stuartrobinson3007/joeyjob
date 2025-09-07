import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, count } from 'drizzle-orm'

import { BILLING_PLANS } from './plans.config'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { organization, todos, member } from '@/database/schema'
import { auth } from '@/lib/auth/auth'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/lib/errors/codes'
import errorTranslations from '@/i18n/locales/en/errors.json'

// Get current subscription using BetterAuth API
export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId! // organizationMiddleware ensures this exists
    console.log('[BILLING SERVER] getSubscription called for org:', orgId)

    // Get organization with current plan
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId))
    console.log(
      '[BILLING SERVER] Organization found:',
      !!org,
      'Plan:',
      org?.currentPlan,
      'StripeCustomerId:',
      org?.stripeCustomerId
    )

    if (!org) {
      throw AppError.notFound(errorTranslations.fields.organization)
    }

    // Use BetterAuth's API to list subscriptions
    let activeSubscription: any = null
    let allSubscriptions: any[] = []

    try {
      const subscriptions = await auth.api.listActiveSubscriptions({
        query: {
          referenceId: orgId,
        },
        headers: context.headers,
      })

      console.log('[BILLING SERVER] BetterAuth subscriptions found:', subscriptions?.length || 0)

      if (subscriptions && subscriptions.length > 0) {
        allSubscriptions = subscriptions
        // Find the most relevant subscription
        activeSubscription =
          subscriptions.find(sub => sub.status === 'active' || sub.status === 'trialing') ||
          subscriptions[0] // Fall back to most recent if none active

        console.log('[BILLING SERVER] Active subscription:', {
          id: activeSubscription?.id,
          status: activeSubscription?.status,
          plan: activeSubscription?.plan,
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
      hasStripeCustomer:
        !!org.stripeCustomerId ||
        !!activeSubscription?.stripeCustomerId ||
        allSubscriptions.length > 0,
    }

    console.log('[BILLING SERVER] Returning:', {
      currentPlan: result.currentPlan,
      hasStripeCustomer: result.hasStripeCustomer,
      hasSubscription: !!activeSubscription,
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
    const orgId = context.organizationId! // organizationMiddleware ensures this exists

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
        headers: context.headers,
      })

      console.log('[BILLING] BetterAuth upgrade result:', !!result)

      if (!result?.url) {
        throw new AppError(
          ERROR_CODES.SYS_CONFIG_ERROR,
          500,
          undefined,
          errorTranslations.server.checkoutSessionFailed
        )
      }

      return { checkoutUrl: result.url }
    } catch (error) {
      console.error('[BILLING] Checkout creation error:', error)

      // Handle specific error types
      if ((error as any).type === 'StripeCardError') {
        throw new AppError(
          ERROR_CODES.BIZ_PAYMENT_FAILED,
          400,
          { reason: (error as any).message },
          errorTranslations.server.paymentFailed
        )
      }

      if ((error as any).type === 'StripeRateLimitError') {
        throw new AppError(ERROR_CODES.SYS_RATE_LIMIT, 429, undefined, 'Rate limit exceeded')
      }

      // Re-throw our errors, wrap unknown ones
      if (error instanceof AppError) {
        throw error
      }

      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        `Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })

// Create billing portal session
export const createBillingPortal = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId! // organizationMiddleware ensures this exists

    // Check billing permissions
    await checkPermission('billing', ['manage'], orgId)

    console.log('[BILLING] createBillingPortal - Organization:', orgId)

    // Get organization to check for stripeCustomerId
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)

    if (!org) {
      throw AppError.notFound(errorTranslations.fields.organization)
    }

    // Try to create portal session
    // BetterAuth's billingPortal should work if there's a customer associated
    try {
      const result = await (auth.api as any).billingPortal({
        body: {
          referenceId: orgId,
        },
        headers: context.headers,
      })

      if (!result?.data?.url) {
        console.error('[BILLING] Portal creation failed - no URL returned')
        throw new AppError(
          ERROR_CODES.SYS_CONFIG_ERROR,
          500,
          undefined,
          errorTranslations.server.billingPortalFailed
        )
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
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          undefined,
          errorTranslations.server.noBillingHistory,
          [{ action: 'upgrade' }]
        )
      }
    }
  })

// Get usage statistics
export const getUsageStats = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId

    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        'Organization ID is required'
      )
    }

    // Get organization with limits
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)

    // Count todos
    const todoCount = await db
      .select({ count: count(todos.id) })
      .from(todos)
      .where(eq(todos.organizationId, orgId))

    // Count members
    const memberCount = await db
      .select({ count: count(member.id) })
      .from(member)
      .where(eq(member.organizationId, orgId))

    const limits = org?.planLimits || BILLING_PLANS.free.limits

    return {
      usage: {
        todos: {
          used: todoCount[0]?.count || 0,
          limit: limits.todos || 0,
          percentage:
            (limits.todos || 0) === -1
              ? 0
              : Math.round(((todoCount[0]?.count || 0) / (limits.todos || 1)) * 100),
        },
        members: {
          used: memberCount[0]?.count || 0,
          limit: limits.members || 0,
          percentage:
            (limits.members || 0) === -1
              ? 0
              : Math.round(((memberCount[0]?.count || 0) / (limits.members || 1)) * 100),
        },
        storage: {
          used: 0, // Implement storage tracking
          limit: limits.storage || 0,
          percentage: 0,
        },
      },
    }
  })

// Check if action is allowed based on plan limits
export const checkPlanLimit = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(
    z.object({
      resource: z.enum(['todos', 'members', 'storage']),
      action: z.enum(['create', 'update']),
    }).parse
  )
  .handler(async ({ data, context }) => {
    // Get usage stats for the organization
    const orgId = context.organizationId

    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        'Organization ID is required'
      )
    }

    // Get organization with limits
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)

    // Count todos
    const todoCount = await db
      .select({ count: count(todos.id) })
      .from(todos)
      .where(eq(todos.organizationId, orgId))

    // Count members
    const memberCount = await db
      .select({ count: count(member.id) })
      .from(member)
      .where(eq(member.organizationId, orgId))

    const limits = org?.planLimits || BILLING_PLANS.free.limits

    const usage = {
      todos: {
        used: todoCount[0]?.count || 0,
        limit: limits.todos || 0,
        percentage:
          (limits.todos || 0) === -1
            ? 0
            : Math.round(((todoCount[0]?.count || 0) / (limits.todos || 1)) * 100),
      },
      members: {
        used: memberCount[0]?.count || 0,
        limit: limits.members || 0,
        percentage:
          (limits.members || 0) === -1
            ? 0
            : Math.round(((memberCount[0]?.count || 0) / (limits.members || 1)) * 100),
      },
      storage: {
        used: 0,
        limit: limits.storage || 0,
        percentage: 0,
      },
    }

    const resourceUsage = usage[data.resource]

    if ((resourceUsage?.limit || 0) === -1) {
      return { allowed: true }
    }

    if (data.action === 'create') {
      return {
        allowed: (resourceUsage?.used || 0) < (resourceUsage?.limit || 0),
        reason:
          (resourceUsage?.used || 0) >= (resourceUsage?.limit || 0)
            ? `You've reached your plan limit of ${resourceUsage?.limit || 0} ${data.resource}`
            : undefined,
      }
    }

    return { allowed: true }
  })
