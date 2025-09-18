import { AlertTriangle } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { useSubscription } from '@/features/billing/hooks/use-subscription'
import { Button } from '@/ui/button'
import { Alert, AlertDescription } from '@/ui/alert'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useClientPermissions } from '@/lib/hooks/use-permissions'

export function BillingStatusDisplay() {
  const { t } = useTranslation('common')
  const { canViewBilling } = useClientPermissions()
  const { data: subscription, isLoading, error } = useSubscription()

  console.log(`🚨 [BillingStatusDisplay] Render state:`, {
    isLoading,
    hasError: !!error,
    hasSubscriptionData: !!subscription,
    subscriptionData: subscription ? {
      currentPlan: subscription.currentPlan,
      subscriptionStatus: subscription.subscription?.status,
      orgPlan: subscription.organization?.currentPlan
    } : null
  })

  // Don't show anything if loading, error, or no subscription data
  if (isLoading || error || !subscription) {
    console.log(`🚨 [BillingStatusDisplay] Not rendering - loading: ${isLoading}, error: ${!!error}, subscription: ${!!subscription}`)
    return null
  }

  const subscriptionRecord = subscription.subscription
  const subscriptionStatus = subscriptionRecord?.status
  const hasBillingError = subscriptionStatus === 'past_due' || subscriptionStatus === 'incomplete'

  console.log(`🚨 [BillingStatusDisplay] Error check:`, {
    subscriptionStatus,
    hasBillingError,
    willDisplay: hasBillingError
  })

  // Only show if there's a billing error
  if (!hasBillingError) {
    console.log(`🚨 [BillingStatusDisplay] Not displaying - no billing error (status: ${subscriptionStatus})`)
    return null
  }

  console.log(`🚨 [BillingStatusDisplay] Displaying billing error alert for status: ${subscriptionStatus}`)

  return (
    <Alert className="py-2">
      <AlertTriangle className="h-3 w-3" />
      <AlertDescription className="text-xs">
        {subscriptionStatus === 'past_due'
          ? t('billing.pastDueAlert')
          : t('billing.incompleteAlert')
        }
        {canViewBilling() && (
          <Button
            asChild
            variant="destructive"
            size="sm"
            className='mt-1'
          >
            <Link to="/billing">
              {t('billing.fixPayment')}
            </Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}