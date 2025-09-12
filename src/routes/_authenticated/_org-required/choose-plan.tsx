import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, CreditCard } from 'lucide-react'

import { createCheckout } from '@/features/billing/lib/billing.server'
import { BILLING_PLANS } from '@/features/billing/lib/plans.config'
import { useSubscription } from '@/features/billing/hooks/use-subscription'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { useClientPermissions } from '@/lib/hooks/use-permissions'
import { useLoadingItems } from '@/taali/hooks/use-loading-state'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import { SubscriptionResponse } from '@/lib/auth/auth-types'

export const Route = createFileRoute('/_authenticated/_org-required/choose-plan')({
  staticData: {
    sidebar: false,
  },
  component: ChoosePlanPage,
})

function ChoosePlanPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly')
  const { t } = useTranslation('billing')
  const { showError } = useErrorHandler()
  const { canManageBilling } = useClientPermissions()
  const { startLoading, stopLoading, isLoading: itemsLoading } = useLoadingItems<string>()
  const { data: subscription } = useSubscription()

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

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6">
            <CreditCard className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground text-lg">
            Select a subscription plan to start using the application
          </p>
        </div>

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
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {(Object.entries(BILLING_PLANS) as [keyof typeof BILLING_PLANS, typeof BILLING_PLANS[keyof typeof BILLING_PLANS]][]).map(([planKey, plan]) => {
            const price = planKey === 'pro'
              ? billingInterval === 'monthly' ? 29 : 290
              : billingInterval === 'monthly' ? 99 : 990

            return (
              <Card key={planKey} className={planKey === 'pro' ? 'border-primary shadow-lg' : ''}>
                {planKey === 'pro' && (
                  <div className="bg-primary text-primary-foreground text-center py-1 text-sm">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="text-4xl font-bold">
                    ${price}
                    <span className="text-lg font-normal text-muted-foreground">
                      /{billingInterval === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-8">
                    <PlanFeature
                      text={`${plan.limits.connectedEmployees} Connected employees`}
                    />
                    <PlanFeature
                      text={`${plan.limits.members === -1 ? 'Unlimited' : plan.limits.members} Team members`}
                    />
                    <PlanFeature
                      text={`${plan.limits.todos === -1 ? 'Unlimited' : plan.limits.todos} Todos`}
                    />
                    <PlanFeature
                      text={`${plan.limits.storage === -1 ? 'Unlimited' : `${plan.limits.storage} MB`} Storage`}
                    />
                    {plan.features.customFields && <PlanFeature text="Custom fields" />}
                    {plan.features.apiAccess && <PlanFeature text="API access" />}
                    {plan.features.prioritySupport && <PlanFeature text="Priority support" />}
                  </ul>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      if (!subscription?.organization) {
                        showError(
                          new AppError(
                            ERROR_CODES.VAL_REQUIRED_FIELD,
                            400,
                            { field: 'Organization' },
                            'Organization required for checkout'
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
                      !subscription?.organization
                    }
                    loading={itemsLoading(planKey)}
                  >
                    Get Started
                  </Button>
                  {!canManageBilling && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Contact your administrator for billing permissions
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            You'll be redirected to Stripe for secure payment processing
          </p>
        </div>
      </div>
    </div>
  )
}

function PlanFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3">
      <Check className="h-4 w-4 text-success flex-shrink-0" />
      <span className="text-sm">{text}</span>
    </li>
  )
}