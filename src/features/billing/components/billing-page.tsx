import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Loader2, AlertCircle, CreditCard, Settings } from 'lucide-react'
import { toast } from 'sonner'

import {
  createCheckout,
  createBillingPortal,
  getSubscription,
  getUsageStats,
} from '../lib/billing.server'
import { BILLING_PLANS } from '../lib/plans.config'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/taali-ui/ui/card'
import { Button } from '@/components/taali-ui/ui/button'
import { Badge } from '@/components/taali-ui/ui/badge'
import { Alert, AlertDescription } from '@/components/taali-ui/ui/alert'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/lib/errors/codes'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/lib/errors/client-handler'


export function BillingPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly')
  const { t } = useTranslation('billing')
  const { showError } = useErrorHandler()

  // Fetch subscription data
  const {
    data: subscription,
    isLoading,
    error: subscriptionError,
    refetch: refetchSubscription,
  } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => getSubscription(),
    retry: 2,
    retryDelay: 1000,
  })

  // Type guard for subscription data
  const hasSubscriptionData = subscription && 'currentPlan' in subscription

  // Comprehensive debug logging
  useEffect(() => {
    console.log('==================== BILLING DEBUG START ====================')
    console.log('[DEBUG] Raw subscription response:', subscription)
    console.log('[DEBUG] Loading state:', isLoading)
    console.log('[DEBUG] Error state:', subscriptionError)
    console.log('[DEBUG] hasSubscriptionData:', hasSubscriptionData)

    if (subscription) {
      console.log('[DEBUG] subscription keys:', Object.keys(subscription))
      console.log('[DEBUG] subscription.currentPlan:', (subscription as any)?.currentPlan)
      console.log('[DEBUG] subscription.subscription:', (subscription as any)?.subscription)
      console.log(
        '[DEBUG] subscription.hasStripeCustomer:',
        (subscription as any)?.hasStripeCustomer
      )
      console.log('[DEBUG] subscription.organization:', (subscription as any)?.organization)
    }
    console.log('==================== BILLING DEBUG END ====================')
  }, [subscription, hasSubscriptionData, isLoading, subscriptionError])

  // Fetch usage stats
  const { data: usage, error: usageError } = useQuery({
    queryKey: ['usage-stats'],
    queryFn: () => getUsageStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!subscription, // Only fetch if subscription data is loaded
    retry: 1,
  })

  // Create checkout mutation
  const createCheckoutMutation = useMutation({
    mutationFn: (checkoutData: { plan: 'pro' | 'business'; interval: 'monthly' | 'annual' }) =>
      createCheckout({ data: checkoutData }),
    onSuccess: (data: { checkoutUrl?: string }) => {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    },
    onError: error => {
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
            'Failed to create billing portal session'
          )
        )
      }
    },
    onError: (error: Error) => {
      console.error('Portal error:', error)
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
  }, [])

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

  const currentPlan = hasSubscriptionData ? (subscription as any).currentPlan : 'free'
  const subscriptionRecord = hasSubscriptionData ? (subscription as any)?.subscription : null
  const allSubscriptions = hasSubscriptionData ? (subscription as any)?.allSubscriptions || [] : []
  const hasActiveSubscription = subscriptionRecord?.status === 'active'
  const isCancelled = subscriptionRecord?.stripeCancelAtPeriodEnd
  const subscriptionStatus = subscriptionRecord?.status
  const hasStripeCustomer = hasSubscriptionData && (subscription as any)?.hasStripeCustomer
  const isPaidPlan = currentPlan !== 'free'

  // Show button if: paid plan, has any subscription history, or has stripe customer
  const showManageButton = isPaidPlan || hasStripeCustomer || allSubscriptions?.length > 0

  // Determine button text based on state
  const getManageButtonText = () => {
    if (hasActiveSubscription) return t('subscription.manage')
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
                    (subscription as any)?.subscription?.stripeCurrentPeriodEnd && (
                      <p className="text-muted-foreground">
                        {isCancelled ? t('subscription.expires') : t('subscription.renews')}{' '}
                        {t('subscription.on')}{' '}
                        {new Date(
                          (subscription as any)?.subscription?.stripeCurrentPeriodEnd
                        ).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  {isCancelled && (
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{t('alerts.cancelled')}</AlertDescription>
                    </Alert>
                  )}
                  {subscriptionStatus === 'past_due' && (
                    <Alert className="mt-2" variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{t('alerts.pastDue')}</AlertDescription>
                    </Alert>
                  )}
                  {subscriptionStatus === 'incomplete' && (
                    <Alert className="mt-2" variant="destructive">
                      <AlertCircle className="h-4 w-4" />
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
                        disabled={createPortalMutation.isPending}
                        title={t('subscription.manageTitle')}
                      >
                        {createPortalMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Settings className="h-4 w-4 mr-2" />
                        )}
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
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load usage statistics. This won't affect your subscription.
            </AlertDescription>
          </Alert>
        )}
        {usage && !usageError && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
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
        <div id="pricing-plans" className="grid md:grid-cols-3 gap-6">
          {Object.entries(BILLING_PLANS).map(([key, plan]) => {
            const planKey = key as keyof typeof BILLING_PLANS
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
                    {t('common:labels.mostPopular')}
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
                      disabled={createPortalMutation.isPending}
                    >
                      {createPortalMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t('subscription.reactivate')}
                    </Button>
                  ) : planKey === 'free' ? (
                    <Button className="w-full" variant="outline" disabled={!hasActiveSubscription}>
                      {hasActiveSubscription
                        ? t('common:actions.download')
                        : t('subscription.currentPlan')}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (!hasSubscriptionData || !(subscription as any)?.organization) {
                          showError(
                            new AppError(
                              ERROR_CODES.VAL_REQUIRED_FIELD,
                              400,
                              { field: 'Organization' },
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
                        createCheckoutMutation.isPending ||
                        !hasSubscriptionData ||
                        !(subscription as any)?.organization
                      }
                    >
                      {createCheckoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {hasActiveSubscription ? t('common:actions.cancel') : t('common:actions.upgrade')}
                    </Button>
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
      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
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
            className={`h-2 rounded-full transition-all ${
              isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-warning' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
