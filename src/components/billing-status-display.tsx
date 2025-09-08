import { AlertTriangle } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { BILLING_PLANS } from '@/features/billing/lib/plans.config'
import { useSubscription } from '@/features/billing/hooks/use-subscription'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Alert, AlertDescription } from '@/ui/alert'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useClientPermissions } from '@/lib/hooks/use-permissions'

export function BillingStatusDisplay() {
  const { t } = useTranslation('common')
  const { canViewBilling } = useClientPermissions()
  const { data: subscription, isLoading, error } = useSubscription()

  // Don't show anything if loading, error, or no subscription data
  if (isLoading || error || !subscription) {
    return null
  }

  const currentPlan = subscription.currentPlan || 'free'
  const subscriptionRecord = subscription.subscription
  const subscriptionStatus = subscriptionRecord?.status
  const isPaidPlan = currentPlan !== 'free'
  const hasBillingError = subscriptionStatus === 'past_due' || subscriptionStatus === 'incomplete'

  // Don't show anything for free plan without billing errors
  if (!isPaidPlan && !hasBillingError) {
    return null
  }

  const planConfig = BILLING_PLANS[currentPlan as keyof typeof BILLING_PLANS]
  const planName = planConfig?.name || currentPlan

  return (
    <div className="pb-2 space-y-2">
      {/* Plan Name Display */}
      {isPaidPlan && !hasBillingError && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('billing.currentPlan')}</span>
          <Badge variant="secondary" className="text-xs">
            {planName}
          </Badge>
        </div>
      )}

      {/* Billing Error Alert */}
      {hasBillingError && (
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
      )}
    </div>
  )
}