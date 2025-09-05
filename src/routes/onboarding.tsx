import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useSession } from '@/lib/auth/auth-hooks'
import { OnboardingForm } from '@/features/auth/components/onboarding-form'
import { getInvitationDetails } from '@/features/organization/lib/onboarding.server'
import { z } from 'zod'

const searchSchema = z.object({
  invite: z.string().optional()
})

export const Route = createFileRoute('/onboarding')({
  validateSearch: searchSchema,
  loader: async ({ location }) => {
    const searchParams = location.search as { invite?: string }

    if (searchParams.invite) {
      try {
        const invitation = await getInvitationDetails({
          data: { invitationId: searchParams.invite }
        })
        return { invitation }
      } catch (error) {
        console.error('Failed to load invitation:', error)
        return { invitation: null }
      }
    }

    return { invitation: null }
  },
  component: OnboardingPage
})

function OnboardingPage() {
  const { data: session, isPending } = useSession()
  const { invitation } = Route.useLoaderData()
  const search = Route.useSearch()

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // If not logged in, redirect to signin
  if (!session) {
    const redirectUrl = search.invite
      ? `/auth/signin?redirect=/onboarding?invite=${search.invite}`
      : '/auth/signin?redirect=/onboarding'
    return <Navigate to={redirectUrl} />
  }

  // If already onboarded, redirect to home
  if (session?.user?.onboardingCompleted) {
    return <Navigate to="/" />
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md">
        <OnboardingForm
          invitationId={search.invite}
          organizationName={invitation?.organizationName}
        />
      </div>
    </div>
  )
}