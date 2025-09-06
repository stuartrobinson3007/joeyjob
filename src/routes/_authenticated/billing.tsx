import { createFileRoute } from '@tanstack/react-router'
import { useSetPageMeta } from '@/lib/hooks/page-context'
import { BillingPage } from '@/features/billing/components/billing-page'

export const Route = createFileRoute('/_authenticated/billing')({
  component: BillingPageWrapper,
})

function BillingPageWrapper() {
  // Set page metadata
  useSetPageMeta({
    title: 'Billing'
  })

  return <BillingPage />
}