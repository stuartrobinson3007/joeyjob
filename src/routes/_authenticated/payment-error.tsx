import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, CreditCard } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'

import { createBillingPortal } from '@/features/billing/lib/billing.server'
import { useSubscription } from '@/features/billing/hooks/use-subscription'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'

export const Route = createFileRoute('/_authenticated/payment-error')({
  staticData: {
    sidebar: false,
  },
  component: PaymentErrorPage,
})

function PaymentErrorPage() {
  const { t } = useTranslation('billing')
  const { showError } = useErrorHandler()
  const { data: subscription } = useSubscription()

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

  const subscriptionStatus = subscription?.subscription?.status
  const hasSubscriptionData = !!subscription?.subscription
  const isPastDue = subscriptionStatus === 'past_due'
  const isIncomplete = subscriptionStatus === 'incomplete'
  const isNoSubscription = !hasSubscriptionData

  const getErrorTitle = () => {
    if (isPastDue) return 'Payment Past Due'
    if (isIncomplete) return 'Payment Incomplete'
    if (isNoSubscription) return 'Subscription Required'
    return 'Payment Required'
  }

  const getErrorDescription = () => {
    if (isPastDue) {
      return 'Your payment is past due. Please update your payment method to continue using the service.'
    }
    if (isIncomplete) {
      return 'Your payment could not be processed. Please complete your payment to continue using the service.'
    }
    if (isNoSubscription) {
      return 'You need an active subscription to access this application. Please select a plan to get started.'
    }
    return 'A valid subscription is required to access this application.'
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Card className="border-destructive">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl font-semibold text-destructive">
              {getErrorTitle()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">
              {getErrorDescription()}
            </p>

            <div className="space-y-3">
              {isNoSubscription ? (
                <>
                  <Button
                    asChild
                    className="w-full"
                    size="lg"
                  >
                    <Link to="/billing">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Select a Plan
                    </Link>
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Choose a subscription plan to access the application.
                  </p>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => createPortalMutation.mutate()}
                    loading={createPortalMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing Portal
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Manage your subscription, update payment methods, and view invoices in your billing portal.
                  </p>
                </>
              )}
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground">
                Need help? Contact{' '}
                <Link to="/contact" className="text-primary hover:underline">
                  support
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}