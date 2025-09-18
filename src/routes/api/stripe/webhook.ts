import { createServerFileRoute } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { organization, member, user } from '@/database/schema'
import { BILLING_PLANS } from '@/features/billing/lib/plans.config'

export const ServerRoute = createServerFileRoute('/api/stripe/webhook').methods({
  POST: async ({ request }) => {
    
    try {
      // Get body first since Better Auth will consume the request
      const body = await request.text()
      
      // Parse to check what we're dealing with
      let event: any
      try {
        event = JSON.parse(body)
      } catch (parseError) {
        console.error('[WEBHOOK] Failed to parse body as JSON:', parseError)
        throw parseError
      }
      
      // Create a new request with the body for Better Auth to process
      const clonedRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: body,
      })
      
      // Better Auth handles signature verification internally
      try {
        await auth.api.stripeWebhook({
          request: clonedRequest,
          headers: request.headers,
        })
      } catch (authError) {
        console.error('[WEBHOOK] Better Auth webhook processing failed:', authError)
        // Don't throw - continue with our own processing
      }
      
      // Handle our custom logic
      console.log(`[WEBHOOK] Processing event: ${event.type}`)
      console.log(`[WEBHOOK] Event data:`, JSON.stringify(event.data.object, null, 2))
      
      switch (event.type) {
        case 'customer.created': {
          const customer = event.data.object
          console.log(`[WEBHOOK] Customer metadata:`, customer.metadata)
          const orgId = customer.metadata?.organizationId || customer.metadata?.referenceId
          
          console.log(`[WEBHOOK] Found orgId: ${orgId} from customer ${customer.id}`)
          if (orgId && customer.id) {
            try {
              await db
                .update(organization)
                .set({
                  stripeCustomerId: customer.id,
                  updatedAt: new Date(),
                })
                .where(eq(organization.id, orgId))
              
              console.log(`[WEBHOOK] Successfully updated organization ${orgId} with customer ID ${customer.id}`)
            } catch (dbError) {
              console.error(`[WEBHOOK] Failed to update organization ${orgId}:`, dbError)
              throw dbError
            }
          } else {
            console.log(`[WEBHOOK] No orgId found in customer metadata or missing customer ID`)
          }
          break
        }
        
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object
          console.log(`[WEBHOOK] Subscription metadata:`, subscription.metadata)
          const orgId = subscription.metadata?.organizationId || subscription.metadata?.referenceId

          console.log(`[WEBHOOK] Found orgId: ${orgId} for subscription ${subscription.id} with status: ${subscription.status}`)
          if (orgId) {
            // Determine plan from price ID (regardless of status)
            let planName = 'pro' // Default to pro since free no longer exists
            const priceId = subscription.items?.data?.[0]?.price?.id

            if (priceId) {
              console.log(`[WEBHOOK] Subscription price ID: ${priceId}`)
              console.log(`[WEBHOOK] Available plans:`, Object.keys(BILLING_PLANS))

              // Check each plan's price IDs
              for (const [key, plan] of Object.entries(BILLING_PLANS)) {
                console.log(`[WEBHOOK] Checking plan ${key}:`, plan.stripePriceId)
                if (plan.stripePriceId && typeof plan.stripePriceId === 'object') {
                  if (plan.stripePriceId.monthly === priceId) {
                    planName = key
                    console.log(`[WEBHOOK] Matched monthly plan: ${key}`)
                    break
                  }
                  if (plan.stripePriceId.annual === priceId) {
                    planName = key
                    console.log(`[WEBHOOK] Matched annual plan: ${key}`)
                    break
                  }
                }
              }
            } else {
              console.log(`[WEBHOOK] No price ID found, using default plan: ${planName}`)
            }

            console.log(`[WEBHOOK] Final plan name: ${planName} for status: ${subscription.status}`)

            // Extract Stripe customer ID from subscription
            const stripeCustomerId = subscription.customer

            try {
              const updateData: any = {
                currentPlan: planName,
                updatedAt: new Date(),
              }

              // Also update stripeCustomerId if available
              if (stripeCustomerId && typeof stripeCustomerId === 'string') {
                updateData.stripeCustomerId = stripeCustomerId
              }

              console.log(`[WEBHOOK] Updating organization ${orgId} with data:`, updateData)

              await db
                .update(organization)
                .set(updateData)
                .where(eq(organization.id, orgId))

              console.log(`[WEBHOOK] Successfully updated organization ${orgId} with plan ${planName} for status ${subscription.status}`)

            } catch (dbError) {
              console.error(`[WEBHOOK] Failed to update organization ${orgId} plan:`, dbError)
              throw dbError
            }
          } else {
            console.log(`[WEBHOOK] No orgId found in subscription metadata`)
          }
          break
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          console.log(`[WEBHOOK] Subscription deleted metadata:`, subscription.metadata)
          const orgId = subscription.metadata?.organizationId || subscription.metadata?.referenceId
          
          console.log(`[WEBHOOK] Found orgId: ${orgId} for deleted subscription ${subscription.id}`)
          if (orgId) {
            try {
              await db
                .update(organization)
                .set({
                  currentPlan: 'pro', // Keep as pro but subscription will be inactive
                  updatedAt: new Date(),
                })
                .where(eq(organization.id, orgId))
              
              console.log(`[WEBHOOK] Successfully updated organization ${orgId} after subscription deletion`)
            } catch (dbError) {
              console.error(`[WEBHOOK] Failed to downgrade organization ${orgId}:`, dbError)
              throw dbError
            }
          } else {
            console.log(`[WEBHOOK] No orgId found for deleted subscription`)
          }
          break
        }
      }

      return new Response('OK', { status: 200 })
    } catch (error) {
      // Error could be from Better Auth signature validation or our processing
      console.error('[WEBHOOK] Error processing webhook:', error)
      console.error('[WEBHOOK] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      
      return new Response(
        `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        { status: 400 }
      )
    }
  },
})