import { useNavigate } from '@tanstack/react-router'
import { CreditCard, CheckCircle2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'

interface SubscriptionRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan?: string | null
}

export function SubscriptionRequiredDialog({
  open,
  onOpenChange,
  currentPlan = null,
}: SubscriptionRequiredDialogProps) {
  const navigate = useNavigate()

  const handleViewPlans = () => {
    onOpenChange(false)
    navigate({ to: '/billing' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Subscription Required
          </DialogTitle>
          <DialogDescription className="pt-3 space-y-3">
            <p>
              You need an active subscription to enable booking forms.
              Upgrade your plan to start accepting bookings from customers.
            </p>

            {/* Plan Features Preview */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Pro Plan Features:</span>
                <Badge variant="secondary">Most Popular</Badge>
              </div>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>Unlimited booking forms</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>10 team members</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>10 connected employees</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>Custom fields & API access</span>
                </li>
              </ul>
            </div>

            {!currentPlan && (
              <p className="text-sm text-muted-foreground">
                Start with a free trial and upgrade anytime.
              </p>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button onClick={handleViewPlans}>
            View Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}