import { createFileRoute } from '@tanstack/react-router'

import { BillingPage } from '@/features/billing/components/billing-page'

export const Route = createFileRoute('/_all-pages/_authenticated/_org-required/billing')({
  component: BillingPageWrapper,
})

function BillingPageWrapper() {
  return (
    <div className="flex flex-col h-full">
      <BillingPage />
    </div>
  )
}
