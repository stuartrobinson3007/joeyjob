import { createFileRoute } from '@tanstack/react-router'
import { useSetPageMeta } from '@/lib/page-context'
import { CreditCard } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/billing')({
  component: BillingPage,
})

function BillingPage() {
  // Set page metadata
  useSetPageMeta({
    title: 'Billing'
  })

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <CreditCard className="w-16 h-16 text-muted-foreground mb-4" />
      <h1 className="text-3xl font-bold mb-2">Billing</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Billing and subscription management functionality will be implemented here.
      </p>
    </div>
  )
}