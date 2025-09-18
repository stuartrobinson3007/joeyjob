import { createFileRoute, Navigate } from '@tanstack/react-router'

import { useSession } from '@/lib/auth/auth-hooks'
import { OnboardingForm } from '@/features/auth/components/onboarding-form'

export const Route = createFileRoute('/_all-pages/_authenticated/onboarding')({
  staticData: {
    sidebar: false,
    skipOrgCheck: true, // User profile completion doesn't require organization access
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const { data: session } = useSession()

  // If already onboarded, redirect to home
  if (session?.user?.onboardingCompleted) {
    return <Navigate to="/" />
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md">
        <OnboardingForm />
      </div>
    </div>
  )
}
