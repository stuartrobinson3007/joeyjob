import { createServerFileRoute } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { organization } from '@/database/schema'
import { eq } from 'drizzle-orm'
import { BILLING_PLANS } from '@/features/billing/lib/plans.config'

export const ServerRoute = createServerFileRoute('/api/stripe/webhook').methods({
  POST: async ({ request }) => {
    const signature = request.headers.get('stripe-signature')
    const body = await request.text()

    if (!signature) {
      return new Response('No signature', { status: 400 })
    }

    try {
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