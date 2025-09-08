import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Loader2, AlertCircle, CreditCard, Settings } from 'lucide-react'
import { toast } from 'sonner'

import {
  createCheckout,
  createBillingPortal,
} from '../lib/billing.server'
import { useSubscription } from '../hooks/use-subscription'
import { useUsageStats } from '../hooks/use-usage-stats'
import { BILLING_PLANS } from '../lib/plans.config'

import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { Alert, AlertDescription } from '@/ui/alert'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { useClientPermissions } from '@/lib/hooks/use-permissions'
import { useLoadingItems } from '@/taali/hooks/use-loading-state'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'
import { SubscriptionResponse } from '@/lib/auth/auth-types'

export function BillingPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly')
  const { t } = useTranslation('billing')
  const { t: tCommon } = useTranslation('common')
  const { showError } = useErrorHandler()
  const { canManageBilling, canViewBilling, isLoading: permissionsLoading } = useClientPermissions()
  const { startLoading, stopLoading, isLoading: itemsLoading } = useLoadingItems<string>()

  // Fetch subscription data
  const {
    data: subscription,
    isLoading,
    error: subscriptionError,
    refetch: refetchSubscription,
  } = useSubscription()

  // Type guard for subscription data
  const hasSubscriptionData = subscription && 'currentPlan' in subscription

  // Fetch usage stats
  const { data: usage, error: usageError } = useUsageStats()

  // Create checkout mutation
  const createCheckoutMutation = useMutation({
    mutationFn: (checkoutData: { plan: 'pro' | 'business'; interval: 'monthly' | 'annual' }) => {
      startLoading(checkoutData.plan)
      return createCheckout({ data: checkoutData })
    },
    onSuccess: (data: { checkoutUrl?: string }, variables) => {
      stopLoading(variables.plan)
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    },
    onError: (error, variables) => {
      stopLoading(variables.plan)
      showError(error)
    },
  })

  // Create portal mutation
  const createPortalMutation = useMutation({
    mutationFn: () => createBillingPortal({}),
    onSuccess: (data: { portalUrl?: string }) => {
      if (data?.portalUrl) {
        window.location.href = data.portalUrl
      } else {
        showError(
          new AppError(
            ERROR_CODES.SYS_CONFIG_ERROR,
            500,
            undefined,
            t('errors.billingPortalFailed')
          )
        )
      }
    },
    onError: (error: Error) => {
      showError(error)
    },
  })

  // Handle URL parameters for success/cancel states
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      toast.success(t('subscription.updated'))
      refetchSubscription()
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('cancelled') === 'true') {
      toast.info(t('subscription.cancelled'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [refetchSubscription, t])

  // Check permissions first
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('loading.permissions')}</span>
      </div>
    )
  }

  // Show unauthorized message if user cannot view billing
  if (!canViewBilling) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title={t('title')} />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">{t('errors.accessRestricted')}</h3>
                <p className="text-muted-foreground">
                  You don't have permission to view billing information. Contact your organization administrator for access.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('usage.loading')}</span>
      </div>
    )
  }

  if (subscriptionError) {
    return <ErrorState error={parseError(subscriptionError)} onRetry={refetchSubscription} />
  }

  const currentPlan = hasSubscriptionData ? (subscription as SubscriptionResponse).currentPlan : 'free'
  const subscriptionData = hasSubscriptionData ? (subscription as SubscriptionResponse) : null
  const subscriptionRecord = subscriptionData?.subscription
  const allSubscriptions = subscriptionData?.allSubscriptions || []
  const hasActiveSubscription = subscriptionRecord?.status === 'active'
  const isCancelled = subscriptionRecord && 'stripeCancelAtPeriodEnd' in subscriptionRecord
    ? Boolean(subscriptionRecord.stripeCancelAtPeriodEnd)
    : false
  const subscriptionStatus = subscriptionRecord?.status
  const hasStripeCustomer = hasSubscriptionData && (subscription as SubscriptionResponse)?.hasStripeCustomer
  const isPaidPlan = currentPlan !== 'free'

  // Show button if: paid plan, has any subscription history, or has stripe customer
  const showManageButton = isPaidPlan || hasStripeCustomer || allSubscriptions?.length > 0

  // Check if subscription needs attention (past_due, incomplete, etc.)
  const hasSubscriptionIssue = subscriptionStatus === 'past_due' || subscriptionStatus === 'incomplete'

  // Determine button text based on state
  const getManageButtonText = () => {
    if (hasActiveSubscription) return t('subscription.manage')
    // If subscription has issues (past_due, incomplete), show manage to let them fix it
    if (hasSubscriptionIssue) return t('subscription.manage')
    if (subscriptionRecord && !hasActiveSubscription) return t('subscription.viewHistory')
    if (hasStripeCustomer && !subscriptionRecord) return t('payment.update')
    return t('subscription.manage')
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={t('title')} />

      <div className="flex-1 p-6">
        {/* Current Plan Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('subscription.current')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold capitalize">{currentPlan}</p>
                    {subscriptionStatus && subscriptionStatus !== 'active' && (
                      <Badge
                        variant={
                          subscriptionStatus === 'canceled'
                            ? 'destructive'
                            : subscriptionStatus === 'past_due'
                              ? 'warning'
                              : subscriptionStatus === 'incomplete'
                                ? 'warning'
                                : subscriptionStatus === 'trialing'
                                  ? 'info'
                                  : 'muted'
                        }
                        appearance="soft"
                      >
                        {subscriptionStatus === 'canceled'
                          ? 'Cancelled'
                          : subscriptionStatus === 'past_due'
                            ? t('subscription.status.pastDue')
                            : subscriptionStatus === 'incomplete'
                              ? 'Incomplete'
                              : subscriptionStatus === 'trialing'
                                ? 'Trial'
                                : subscriptionStatus}
                      </Badge>
                    )}
                  </div>
                  {hasSubscriptionData &&
                    subscriptionRecord && 'stripeCurrentPeriodEnd' in subscriptionRecord &&
                    (subscriptionRecord.stripeCurrentPeriodEnd as string) && (
                      <p className="text-muted-foreground">
                        {isCancelled ? t('subscription.expires') : t('subscription.renews')}{' '}
                        {t('subscription.on')}{' '}
                        {(() => {
                          const periodEnd = 'stripeCurrentPeriodEnd' in subscriptionRecord
                            ? subscriptionRecord.stripeCurrentPeriodEnd as string
                            : null
                          if (!periodEnd) return 'N/A'
                          return new Date(periodEnd).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        })()}
                      </p>
                    )}
                  {isCancelled && (
                    <Alert className="mt-2">
                      <AlertCircle />
                      <AlertDescription>{t('alerts.cancelled')}</AlertDescription>
                    </Alert>
                  )}
                  {subscriptionStatus === 'past_due' && (
                    <Alert className="mt-2" variant="destructive">
                      <AlertCircle />
                      <AlertDescription>{t('alerts.pastDue')}</AlertDescription>
                    </Alert>
                  )}
                  {subscriptionStatus === 'incomplete' && (
                    <Alert className="mt-2" variant="destructive">
                      <AlertCircle />
                      <AlertDescription>{t('alerts.incomplete')}</AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="flex gap-2">
                  {showManageButton && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => createPortalMutation.mutate()}
                        disabled={!canManageBilling}
                        loading={createPortalMutation.isPending}
                        title={t('subscription.manageTitle')}
                      >
                        <Settings />
                        {getManageButtonText()}
                      </Button>
                    </>
                  )}
                  {!hasActiveSubscription && currentPlan === 'free' && !showManageButton && (
                    <Button
                      variant="default"
                      onClick={() => {
                        const element = document.getElementById('pricing-plans')
                        element?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      {t('subscription.upgrade')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        {usageError && (
          <Alert className="mb-8" variant="destructive">
            <AlertCircle />
            <AlertDescription>
              Failed to load usage statistics. This won't affect your subscription.
            </AlertDescription>
          </Alert>
        )}
        {usage && !usageError && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t('usage.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Todos Usage */}
                <UsageBar
                  label={t('usage.todos')}
                  used={usage.usage.todos.used ?? 0}
                  limit={usage.usage.todos.limit ?? 0}
                  percentage={usage.usage.todos.percentage ?? 0}
                />

                {/* Members Usage */}
                <UsageBar
                  label={t('usage.teamMembers')}
                  used={usage.usage.members.used ?? 0}
                  limit={usage.usage.members.limit ?? 0}
                  percentage={usage.usage.members.percentage ?? 0}
                />

                {/* Storage Usage */}
                <UsageBar
                  label={t('usage.storage')}
                  used={usage.usage.storage.used ?? 0}
                  limit={usage.usage.storage.limit ?? 0}
                  percentage={usage.usage.storage.percentage ?? 0}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border p-1">
            <button
              className={`px-4 py-2 rounded-md transition-colors ${billingInterval === 'monthly'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
                }`}
              onClick={() => setBillingInterval('monthly')}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-2 rounded-md transition-colors ${billingInterval === 'annual'
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
        <div id="pricing-plans" className="grid md:grid-cols-3 gap-6">
          {(Object.entries(BILLING_PLANS) as [keyof typeof BILLING_PLANS, typeof BILLING_PLANS[keyof typeof BILLING_PLANS]][]).map(([planKey, plan]) => {
            const isCurrentPlan = currentPlan === planKey
            const price =
              planKey === 'free'
                ? 0
                : planKey === 'pro'
                  ? billingInterval === 'monthly'
                    ? 29
                    : 290
                  : billingInterval === 'monthly'
                    ? 99
                    : 990

            return (
              <Card key={planKey} className={planKey === 'pro' ? 'border-primary shadow-lg' : ''}>
                {planKey === 'pro' && (
                  <div className="bg-primary text-primary-foreground text-center py-1 text-sm">
                    {t('labels.mostPopular')}
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
                      text={t('features.todosLimit', {
                        limit: plan.limits.todos === -1 ? t('unlimited') : plan.limits.todos,
                      })}
                    />
                    <PlanFeature
                      text={t('features.membersLimit', {
                        limit: plan.limits.members === -1 ? t('unlimited') : plan.limits.members,
                      })}
                    />
                    <PlanFeature
                      text={t('features.storageLimit', {
                        limit:
                          plan.limits.storage === -1 ? t('unlimited') : `${plan.limits.storage} MB`,
                      })}
                    />
                    {plan.features.customFields && (
                      <PlanFeature text={t('features.customFields')} />
                    )}
                    {plan.features.apiAccess && <PlanFeature text={t('features.apiAccess')} />}
                    {plan.features.prioritySupport && (
                      <PlanFeature text={t('features.prioritySupport')} />
                    )}
                  </ul>

                  {isCurrentPlan && !isCancelled ? (
                    <Button className="w-full" disabled>
                      {t('subscription.currentPlan')}
                    </Button>
                  ) : isCurrentPlan && isCancelled ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => createPortalMutation.mutate()}
                      disabled={!canManageBilling}
                      loading={createPortalMutation.isPending}
                    >
                      {t('subscription.reactivate')}
                    </Button>
                  ) : planKey === 'free' ? (
                    <Button className="w-full" variant="outline" disabled={!hasActiveSubscription}>
                      {hasActiveSubscription
                        ? tCommon('actions.download')
                        : t('subscription.currentPlan')}
                    </Button>
                  ) : (
                    <div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          if (!hasSubscriptionData || !(subscription as SubscriptionResponse)?.organization) {
                            showError(
                              new AppError(
                                ERROR_CODES.VAL_REQUIRED_FIELD,
                                400,
                                { field: t('fields.organization', { ns: 'errors' }) },
                                t('subscription.noOrganization')
                              )
                            )
                            return
                          }
                          createCheckoutMutation.mutate({
                            plan: planKey as 'pro' | 'business',
                            interval: billingInterval,
                          })
                        }}
                        disabled={
                          !canManageBilling ||
                          !hasSubscriptionData ||
                          !(subscription as SubscriptionResponse)?.organization
                        }
                        loading={itemsLoading(planKey)}
                      >
                        {(() => {
                          // Define plan hierarchy for comparison
                          const planHierarchy: Record<string, number> = {
                            'free': 0,
                            'pro': 1,
                            'business': 2
                          }

                          const currentPlanLevel = planHierarchy[currentPlan] ?? 0
                          const targetPlanLevel = planHierarchy[planKey] ?? 0

                          // If target plan is higher level, show upgrade
                          if (targetPlanLevel > currentPlanLevel) {
                            return t('subscription.upgrade')
                          }

                          // If target plan is lower level, show downgrade
                          if (targetPlanLevel < currentPlanLevel) {
                            return t('subscription.downgrade') || 'Downgrade'
                          }

                          // If same level but has active subscription, show cancel
                          if (hasActiveSubscription) {
                            return tCommon('actions.cancel')
                          }

                          return t('subscription.upgrade')
                        })()}
                      </Button>
                      {!canManageBilling && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('messages.contactAdmin')}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PlanFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="h-4 w-4 text-success flex-shrink-0" />
      <span>{text}</span>
    </li>
  )
}

function UsageBar({
  label,
  used,
  limit,
  percentage,
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
            className={`h-2 rounded-full transition-all ${isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-warning' : 'bg-primary'
              }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
