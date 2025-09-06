import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/taali-ui/ui/card'
import { Button } from '@/components/taali-ui/ui/button'
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
    mutationFn: (checkoutData: { plan: 'pro' | 'business'; interval: 'monthly' | 'annual' }) => 
      createCheckout({ data: checkoutData }),
    onSuccess: (data: any) => {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    },
    onError: () => {
      toast.error('Failed to create checkout session')
    },
  })

  // Create portal mutation
  const createPortalMutation = useMutation({
    mutationFn: () => createBillingPortal({}),
    onSuccess: (data: any) => {
      if (data?.portalUrl) {
        window.location.href = data.portalUrl
      }
    },
    onError: () => {
      toast.error('Failed to open billing portal')
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
                onClick={() => createPortalMutation.mutate()}
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