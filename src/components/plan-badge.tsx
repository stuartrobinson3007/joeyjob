import { BILLING_PLANS } from '@/features/billing/lib/plans.config'
import { useSubscription } from '@/features/billing/hooks/use-subscription'
import { Badge } from '@/ui/badge'

export function PlanBadge() {
  const { data: subscription, isLoading, error } = useSubscription()

  console.log(`🎯 [PlanBadge] Render state:`, {
    isLoading,
    hasError: !!error,
    hasSubscriptionData: !!subscription,
    subscriptionData: subscription ? {
      currentPlan: subscription.currentPlan,
      subscriptionStatus: subscription.subscription?.status,
      allSubscriptionsCount: subscription.allSubscriptions?.length || 0
    } : null
  })

  // Don't show anything if loading, error, or no subscription data
  if (isLoading || error || !subscription) {
    console.log(`🎯 [PlanBadge] Not rendering - loading: ${isLoading}, error: ${!!error}, subscription: ${!!subscription}`)
    return null
  }

  const currentPlan = subscription.currentPlan || subscription.subscription?.plan
  const shouldShow = !!currentPlan

  console.log(`🎯 [PlanBadge] Display logic:`, {
    orgCurrentPlan: subscription.currentPlan,
    subscriptionPlan: subscription.subscription?.plan,
    finalCurrentPlan: currentPlan,
    shouldShow
  })

  // Show if we have any plan information
  if (!shouldShow) {
    console.log(`🎯 [PlanBadge] Not displaying - no plan information`)
    return null
  }

  const planConfig = BILLING_PLANS[currentPlan as keyof typeof BILLING_PLANS]
  const planName = planConfig?.name || currentPlan

  console.log(`🎯 [PlanBadge] Displaying plan badge: ${planName}`)

  return (
    <Badge
      variant="secondary"
      className="text-xs"
    >
      {planName}
    </Badge>
  )
}