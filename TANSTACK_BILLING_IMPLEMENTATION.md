# TanStack Start + Better Auth Billing Implementation Guide

A production-ready billing implementation guide for TanStack Start applications using Better Auth Organizations, Drizzle ORM, TanStack Query, and Stripe.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Better Auth + Stripe Setup](#better-auth--stripe-setup)
4. [Server Functions Implementation](#server-functions-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Webhook Handler](#webhook-handler)
7. [Permission System](#permission-system)
8. [Testing & Development](#testing--development)
9. [Production Checklist](#production-checklist)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend Layer                       │
│  - Billing Page (TanStack Router)                       │
│  - Plan Selection Components                            │
│  - Usage Dashboards                                     │
│  - TanStack Query Hooks                                 │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│              TanStack Start Server Functions            │
│  - createServerFn with validation                       │
│  - Organization middleware                              │
│  - Better Auth permission checks                        │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│           Better Auth + Stripe Plugin                   │
│  - Organization-based subscriptions                     │
│  - Seat management                                      │
│  - Billing portal integration                           │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                 Drizzle ORM + PostgreSQL                │
│  - Organizations table                                  │
│  - Subscriptions table (Better Auth)                    │
│  - Custom billing metadata                              │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### 1. Update Organization Table

```typescript
// src/database/schema.ts
import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core'

// Extend the existing organization table
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  
  // Billing fields
  currentPlan: text("current_plan").default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id"), // Managed by Better Auth Stripe plugin
  planLimits: jsonb("plan_limits").$type<{
    todos?: number,
    members?: number,
    storage?: number
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: text("metadata"),
});

// Better Auth Stripe plugin automatically creates this
export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end"),
  stripeCurrentPeriodStart: timestamp("stripe_current_period_start"),
  stripeCancelAt: timestamp("stripe_cancel_at"),
  stripeCancelAtPeriodEnd: boolean("stripe_cancel_at_period_end"),
  stripeTrialStart: timestamp("stripe_trial_start"),
  stripeTrialEnd: timestamp("stripe_trial_end"),
  referenceId: text("reference_id"), // This will be organizationId
  seats: integer("seats"),
  status: text("status"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### 2. Run Migrations

```bash
npm run db:generate
npm run db:migrate
```

## Better Auth + Stripe Setup

### 1. Install Dependencies

```bash
npm install @better-auth/stripe stripe@^18.0.0
```

### 2. Configure Better Auth with Stripe Plugin

```typescript
// src/lib/auth/auth.ts
import { betterAuth } from 'better-auth'
import { stripe as stripePlugin } from '@better-auth/stripe'
import { organization } from 'better-auth/plugins'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
})

export const auth = betterAuth({
  // ... existing config
  plugins: [
    organization({
      // ... existing organization config
    }),
    stripePlugin({
      stripeClient: stripe,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: false, // We'll create on org creation
      successUrl: `${process.env.APP_URL}/billing?success=true`,
      cancelUrl: `${process.env.APP_URL}/billing`,
    }),
    // ... other plugins
  ]
})
```

### 3. Plan Configuration

```typescript
// src/features/billing/lib/plans.config.ts
export const BILLING_PLANS = {
  free: {
    name: 'Free',
    stripePriceId: null,
    features: {
      todos: 10,
      members: 2,
      customFields: false,
      apiAccess: false,
      prioritySupport: false,
    },
    limits: {
      todos: 10,
      members: 2,
      storage: 100, // MB
    }
  },
  pro: {
    name: 'Pro',
    stripePriceId: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
      annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
    },
    features: {
      todos: -1, // Unlimited
      members: 10,
      customFields: true,
      apiAccess: true,
      prioritySupport: false,
    },
    limits: {
      todos: -1,
      members: 10,
      storage: 5000, // MB
    },
    seats: 10, // For Better Auth Stripe plugin
  },
  business: {
    name: 'Business',
    stripePriceId: {
      monthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID!,
      annual: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID!,
    },
    features: {
      todos: -1,
      members: -1,
      customFields: true,
      apiAccess: true,
      prioritySupport: true,
    },
    limits: {
      todos: -1,
      members: -1,
      storage: -1, // Unlimited
    },
    seats: 50,
  },
} as const

export type PlanType = keyof typeof BILLING_PLANS
```

## Server Functions Implementation

### 1. Billing Middleware

```typescript
// src/features/billing/lib/billing-middleware.ts
import { createMiddleware } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth/auth'
import { checkPermission } from '@/lib/utils/permissions'

export const billingAdminMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session) {
      throw new Error('Unauthorized')
    }

    const activeOrgId = session.session.activeOrganizationId
    if (!activeOrgId) {
      throw new Error('No active organization')
    }

    // Check if user has billing admin permissions
    const canManageBilling = await checkPermission(
      session.user.id,
      activeOrgId,
      'billing',
      'manage'
    )

    if (!canManageBilling) {
      throw new Error('Insufficient permissions to manage billing')
    }

    return next({
      context: {
        user: session.user,
        session: session.session,
        organizationId: activeOrgId,
      }
    })
  }
)
```

### 2. Billing Server Functions

```typescript
// src/features/billing/lib/billing.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { billingAdminMiddleware } from './billing-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { db } from '@/lib/db/db'
import { organization, subscription } from '@/database/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth'
import { BILLING_PLANS } from './plans.config'

// Get current subscription
export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId
    
    // Get organization with current plan
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, orgId)
    })

    if (!org) {
      throw new Error('Organization not found')
    }

    // Get active subscription from Better Auth
    const subs = await db.query.subscription.findFirst({
      where: and(
        eq(subscription.referenceId, orgId),
        eq(subscription.status, 'active')
      )
    })

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
  .middleware([billingAdminMiddleware])
  .validator(createCheckoutSchema.parse)
  .handler(async ({ data, context }) => {
    const { plan, interval } = data
    const orgId = context.organizationId
    
    // Get organization
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, orgId)
    })

    if (!org) {
      throw new Error('Organization not found')
    }

    const planConfig = BILLING_PLANS[plan]
    const priceId = planConfig.stripePriceId[interval]
    
    // Use Better Auth's Stripe plugin to create subscription
    const result = await auth.api.subscription.upgrade({
      body: {
        priceId,
        referenceId: orgId, // Link to organization
        seats: planConfig.seats,
        metadata: {
          organizationId: orgId,
          plan,
          interval
        }
      },
      headers: context.headers
    })

    if (!result?.data?.url) {
      throw new Error('Failed to create checkout session')
    }

    return { checkoutUrl: result.data.url }
  })

// Cancel subscription
export const cancelSubscription = createServerFn({ method: 'POST' })
  .middleware([billingAdminMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId
    
    // Find active subscription
    const activeSub = await db.query.subscription.findFirst({
      where: and(
        eq(subscription.referenceId, orgId),
        eq(subscription.status, 'active')
      )
    })

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
  .middleware([billingAdminMiddleware])
  .handler(async ({ context }) => {
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
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, orgId)
    })

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
    const stats = await getUsageStats({ context })
    const resourceUsage = stats.usage[data.resource]
    
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
```

## Frontend Implementation

### 1. Billing Page Component

```tsx
// src/routes/_authenticated/billing.tsx
import { createFileRoute } from '@tanstack/react-router'
import { BillingPage } from '@/features/billing/components/billing-page'
import { getSubscription } from '@/features/billing/lib/billing.server'

export const Route = createFileRoute('/_authenticated/billing')({
  loader: () => getSubscription(),
  component: BillingPage,
})
```

```tsx
// src/features/billing/components/billing-page.tsx
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Loader2 } from 'lucide-react'
import { 
  createCheckout, 
  createBillingPortal, 
  getSubscription,
  getUsageStats 
} from '../lib/billing.server'
import { BILLING_PLANS } from '../lib/plans.config'
import { toast } from 'sonner'

export function BillingPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly')
  
  // Fetch subscription data
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => getSubscription(),
  })

  // Fetch usage stats
  const { data: usage } = useQuery({
    queryKey: ['usage-stats'],
    queryFn: () => getUsageStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Create checkout mutation
  const createCheckoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    },
    onError: (error) => {
      toast.error('Failed to create checkout session')
      console.error(error)
    },
  })

  // Create portal mutation
  const createPortalMutation = useMutation({
    mutationFn: createBillingPortal,
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.location.href = data.portalUrl
      }
    },
    onError: (error) => {
      toast.error('Failed to open billing portal')
      console.error(error)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const currentPlan = subscription?.currentPlan || 'free'
  const hasActiveSubscription = subscription?.subscription?.status === 'active'

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>

      {/* Current Plan Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-2xl font-bold capitalize">{currentPlan}</p>
              {subscription?.subscription?.stripeCurrentPeriodEnd && (
                <p className="text-muted-foreground">
                  Renews on {new Date(subscription.subscription.stripeCurrentPeriodEnd).toLocaleDateString()}
                </p>
              )}
              {subscription?.subscription?.stripeCancelAtPeriodEnd && (
                <p className="text-destructive">
                  Cancels at end of period
                </p>
              )}
            </div>
            {hasActiveSubscription && (
              <Button
                variant="outline"
                onClick={() => createPortalMutation.mutate({})}
                disabled={createPortalMutation.isPending}
              >
                {createPortalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Manage Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      {usage && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Todos Usage */}
              <UsageBar
                label="Todos"
                used={usage.usage.todos.used}
                limit={usage.usage.todos.limit}
                percentage={usage.usage.todos.percentage}
              />
              
              {/* Members Usage */}
              <UsageBar
                label="Team Members"
                used={usage.usage.members.used}
                limit={usage.usage.members.limit}
                percentage={usage.usage.members.percentage}
              />
              
              {/* Storage Usage */}
              <UsageBar
                label="Storage (MB)"
                used={usage.usage.storage.used}
                limit={usage.usage.storage.limit}
                percentage={usage.usage.storage.percentage}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg border p-1">
          <button
            className={`px-4 py-2 rounded-md transition-colors ${
              billingInterval === 'monthly' 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-muted'
            }`}
            onClick={() => setBillingInterval('monthly')}
          >
            Monthly
          </button>
          <button
            className={`px-4 py-2 rounded-md transition-colors ${
              billingInterval === 'annual' 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-muted'
            }`}
            onClick={() => setBillingInterval('annual')}
          >
            Annual (Save 20%)
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {Object.entries(BILLING_PLANS).map(([key, plan]) => {
          const planKey = key as keyof typeof BILLING_PLANS
          const isCurrentPlan = currentPlan === planKey
          const price = planKey === 'free' ? 0 : 
            planKey === 'pro' ? (billingInterval === 'monthly' ? 29 : 290) :
            (billingInterval === 'monthly' ? 99 : 990)

          return (
            <Card
              key={planKey}
              className={planKey === 'pro' ? 'border-primary shadow-lg' : ''}
            >
              {planKey === 'pro' && (
                <div className="bg-primary text-primary-foreground text-center py-1 text-sm">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="text-3xl font-bold">
                  ${price}
                  {planKey !== 'free' && (
                    <span className="text-base font-normal text-muted-foreground">
                      /{billingInterval === 'monthly' ? 'month' : 'year'}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  <PlanFeature 
                    text={`${plan.limits.todos === -1 ? 'Unlimited' : plan.limits.todos} todos`}
                  />
                  <PlanFeature 
                    text={`${plan.limits.members === -1 ? 'Unlimited' : plan.limits.members} team members`}
                  />
                  <PlanFeature 
                    text={`${plan.limits.storage === -1 ? 'Unlimited' : `${plan.limits.storage} MB`} storage`}
                  />
                  {plan.features.customFields && (
                    <PlanFeature text="Custom fields" />
                  )}
                  {plan.features.apiAccess && (
                    <PlanFeature text="API access" />
                  )}
                  {plan.features.prioritySupport && (
                    <PlanFeature text="Priority support" />
                  )}
                </ul>
                
                {isCurrentPlan ? (
                  <Button className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : planKey === 'free' ? (
                  <Button className="w-full" variant="outline" disabled>
                    {hasActiveSubscription ? 'Downgrade' : 'Current Plan'}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => createCheckoutMutation.mutate({
                      plan: planKey as 'pro' | 'business',
                      interval: billingInterval,
                    })}
                    disabled={createCheckoutMutation.isPending}
                  >
                    {createCheckoutMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {hasActiveSubscription ? 'Change Plan' : 'Upgrade'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function PlanFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
      <span>{text}</span>
    </li>
  )
}

function UsageBar({ 
  label, 
  used, 
  limit, 
  percentage 
}: { 
  label: string
  used: number
  limit: number
  percentage: number 
}) {
  const isUnlimited = limit === -1
  const isNearLimit = !isUnlimited && percentage > 80
  const isAtLimit = !isUnlimited && percentage >= 100

  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {used}
          {!isUnlimited && ` / ${limit}`}
          {isUnlimited && ' (Unlimited)'}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isAtLimit ? 'bg-destructive' :
              isNearLimit ? 'bg-warning' :
              'bg-primary'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
```

### 2. Plan Limit Enforcement Hook

```typescript
// src/features/billing/hooks/use-plan-limits.ts
import { useMutation, useQuery } from '@tanstack/react-query'
import { checkPlanLimit } from '../lib/billing.server'
import { toast } from 'sonner'

export function usePlanLimits() {
  const checkLimit = useMutation({
    mutationFn: checkPlanLimit,
    onError: (error) => {
      console.error('Failed to check plan limit:', error)
    }
  })

  const canCreate = async (resource: 'todos' | 'members' | 'storage') => {
    const result = await checkLimit.mutateAsync({ 
      resource, 
      action: 'create' 
    })
    
    if (!result.allowed && result.reason) {
      toast.error(result.reason)
    }
    
    return result.allowed
  }

  return {
    canCreate,
    checkLimit: checkLimit.mutate,
    isChecking: checkLimit.isPending,
  }
}

// Usage in components
export function CreateTodoButton() {
  const { canCreate } = usePlanLimits()
  
  const handleCreate = async () => {
    const allowed = await canCreate('todos')
    if (!allowed) {
      // Show upgrade prompt
      return
    }
    // Proceed with creation
  }
  
  return <Button onClick={handleCreate}>Create Todo</Button>
}
```

## Webhook Handler

```typescript
// src/routes/api/stripe/webhook.ts
import { createAPIFileRoute } from '@tanstack/react-start/api'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { organization } from '@/database/schema'
import { eq } from 'drizzle-orm'
import { BILLING_PLANS } from '@/features/billing/lib/plans.config'

export const APIRoute = createAPIFileRoute('/api/stripe/webhook')({
  POST: async ({ request }) => {
    const signature = request.headers.get('stripe-signature')
    const body = await request.text()

    if (!signature) {
      return new Response('No signature', { status: 400 })
    }

    // Better Auth's Stripe plugin handles webhook verification and processing
    // But we need to update our organization table when subscription changes
    
    try {
      // Let Better Auth handle the webhook first
      const response = await auth.api.stripe.webhook({
        body,
        headers: {
          'stripe-signature': signature
        }
      })

      // Parse the event to update organization
      const event = JSON.parse(body)
      
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object
          const orgId = subscription.metadata?.organizationId
          
          if (orgId) {
            // Determine plan from price ID
            let planName = 'free'
            const priceId = subscription.items.data[0]?.price.id
            
            for (const [key, plan] of Object.entries(BILLING_PLANS)) {
              if (plan.stripePriceId?.monthly === priceId || 
                  plan.stripePriceId?.annual === priceId) {
                planName = key
                break
              }
            }
            
            // Update organization
            await db.update(organization)
              .set({
                currentPlan: planName,
                planLimits: BILLING_PLANS[planName as keyof typeof BILLING_PLANS].limits,
                updatedAt: new Date()
              })
              .where(eq(organization.id, orgId))
          }
          break
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          const orgId = subscription.metadata?.organizationId
          
          if (orgId) {
            // Downgrade to free plan
            await db.update(organization)
              .set({
                currentPlan: 'free',
                planLimits: BILLING_PLANS.free.limits,
                updatedAt: new Date()
              })
              .where(eq(organization.id, orgId))
          }
          break
        }
      }

      return new Response('OK', { status: 200 })
    } catch (error) {
      console.error('Webhook error:', error)
      return new Response('Webhook processing failed', { status: 500 })
    }
  }
})
```

## Permission System

### 1. Update Access Control

```typescript
// src/lib/auth/auth.ts
import { createAccessControl } from 'better-auth/plugins/access'

const statement = {
  ...defaultStatements,
  todos: ["create", "read", "update", "delete"],
  billing: ["view", "manage"], // Add billing permissions
} as const

const ac = createAccessControl(statement)

// Update roles
const member = ac.newRole({
  todos: ["create", "read", "update", "delete"],
  billing: ["view"], // Can view billing
})

const admin = ac.newRole({
  ...member.statements,
  member: ["create", "read", "update", "delete"],
  billing: ["view", "manage"], // Can manage billing
})

const owner = ac.newRole({
  ...adminAc.statements,
  billing: ["view", "manage"],
})
```

### 2. Permission Checks

```typescript
// src/lib/utils/permissions.ts
import { auth, ac } from '@/lib/auth/auth'

export async function checkPermission(
  userId: string,
  organizationId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const member = await db.query.member.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    )
  })

  if (!member) return false

  const role = ac.roles[member.role]
  if (!role) return false

  return role.hasPermission(resource, action)
}

export async function requireBillingAdmin(
  userId: string,
  organizationId: string
): Promise<void> {
  const canManage = await checkPermission(
    userId,
    organizationId,
    'billing',
    'manage'
  )

  if (!canManage) {
    throw new Error('Billing admin permission required')
  }
}
```

## Testing & Development

### 1. Environment Variables

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_xxx
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_xxx

# Better Auth
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=xxx

# App
APP_URL=http://localhost:3000
```

### 2. Stripe CLI Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted

# Create test prices
stripe prices create \
  --product prod_xxx \
  --unit-amount 2900 \
  --currency usd \
  --recurring[interval]=month
```

### 3. Test Utilities

```typescript
// src/features/billing/lib/billing.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createCheckout, getSubscription } from './billing.server'

describe('Billing Server Functions', () => {
  it('should create checkout session for pro plan', async () => {
    const result = await createCheckout({
      plan: 'pro',
      interval: 'monthly'
    })
    
    expect(result.checkoutUrl).toContain('checkout.stripe.com')
  })

  it('should enforce plan limits', async () => {
    const result = await checkPlanLimit({
      resource: 'todos',
      action: 'create'
    })
    
    expect(result.allowed).toBeDefined()
  })

  it('should track usage correctly', async () => {
    const usage = await getUsageStats()
    
    expect(usage.usage.todos.used).toBeGreaterThanOrEqual(0)
    expect(usage.usage.todos.limit).toBeDefined()
  })
})
```

## Production Checklist

### Pre-Launch
- [ ] Create Stripe products and prices in production
- [ ] Configure production webhook endpoint in Stripe
- [ ] Set all production environment variables
- [ ] Test complete checkout flow in staging
- [ ] Verify webhook signature validation
- [ ] Test subscription upgrades/downgrades
- [ ] Test cancellation flow
- [ ] Verify plan limit enforcement
- [ ] Test billing portal access
- [ ] Review error handling and logging

### Security
- [ ] Verify all billing endpoints require authentication
- [ ] Confirm permission checks on sensitive operations
- [ ] Validate webhook signatures
- [ ] Use HTTPS for all billing operations
- [ ] Implement rate limiting on billing endpoints
- [ ] Set up monitoring for failed payments
- [ ] Configure alerts for subscription changes

### Monitoring
- [ ] Set up Stripe webhook monitoring
- [ ] Configure payment failure alerts
- [ ] Track subscription metrics (MRR, churn, etc.)
- [ ] Monitor plan limit usage
- [ ] Set up error tracking for billing operations
- [ ] Create admin dashboard for billing overview

### Documentation
- [ ] Document billing flow for support team
- [ ] Create user-facing billing FAQ
- [ ] Document test card numbers
- [ ] Create runbook for common billing issues
- [ ] Document plan migration procedures

## Common Issues & Solutions

### Issue: Subscription not linking to organization
**Solution**: Ensure `referenceId` is set to `organizationId` when creating subscriptions

### Issue: Webhook events not processing
**Solution**: Verify webhook secret and endpoint URL, check Stripe webhook logs

### Issue: Plan limits not enforcing
**Solution**: Check that organization `planLimits` field is updated on subscription changes

### Issue: User can't access billing page
**Solution**: Verify user has 'billing:view' permission in their organization role

### Issue: Checkout session redirects failing
**Solution**: Ensure `successUrl` and `cancelUrl` are absolute URLs with correct domain

## Migration Guide

For existing applications:

1. **Add billing fields to organization table**
```sql
ALTER TABLE organization 
ADD COLUMN current_plan TEXT DEFAULT 'free',
ADD COLUMN plan_limits JSONB;
```

2. **Install Better Auth Stripe plugin**
```bash
npm install @better-auth/stripe
```

3. **Run Better Auth migrations**
```bash
npm run auth:migrate
```

4. **Update existing organizations**
```sql
UPDATE organization 
SET current_plan = 'free',
    plan_limits = '{"todos": 10, "members": 2, "storage": 100}'::jsonb
WHERE current_plan IS NULL;
```

5. **Deploy webhook endpoint before going live**

6. **Test with existing data in staging environment**

This implementation provides a production-ready billing system that integrates seamlessly with TanStack Start, Better Auth Organizations, and Stripe, while maintaining type safety and proper error handling throughout.