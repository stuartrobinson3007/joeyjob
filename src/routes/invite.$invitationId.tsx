import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { authClient } from '@/lib/auth/auth-client'
import { getInvitationDetails } from '@/features/organization/lib/onboarding.server'
import { OTPSignIn } from '@/features/auth/components/otp-sign-in'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Building2, Mail, UserPlus, AlertCircle, Loader2 } from 'lucide-react'
import { useListOrganizations, useSession } from '@/lib/auth/auth-hooks'
import { setActiveOrganizationId } from '@/features/organization/lib/organization-utils'

export const Route = createFileRoute('/invite/$invitationId')({
  loader: async ({ params }) => {
    try {
      const invitation = await getInvitationDetails({
        data: { invitationId: params.invitationId }
      })
      return { invitation }
    } catch (error) {
      console.error('Failed to load invitation:', error)
      return { invitation: null }
    }
  },
  component: InvitationPage
})

function InvitationPage() {
  const { invitationId } = Route.useParams()
  const { invitation } = Route.useLoaderData()
  const { data: session, isPending: sessionPending, refetch: refetchSession } = useSession()
  const { refetch: refetchOrganizations } = useListOrganizations()
  const navigate = useNavigate()
  const [isAccepting, setIsAccepting] = useState(false)
  const [showOTPForm, setShowOTPForm] = useState(false)

  useEffect(() => {
    // Store invitation ID in localStorage for post-auth retrieval
    if (invitationId && typeof window !== 'undefined') {
      localStorage.setItem('pendingInvitationId', invitationId)
    }
  }, [invitationId])

  const handleAcceptInvitation = async () => {
    if (!session) {
      // Show OTP sign-in form for seamless invitation acceptance
      setShowOTPForm(true)
      // Automatically send OTP to the invitation email
      try {
        await authClient.emailOtp.sendVerificationOtp({
          email: invitation?.email || '',
          type: "sign-in"
        })
        toast.success('Verification code sent to your email')
      } catch (error) {
        toast.error('Failed to send verification code')
      }
      return
    }

    // Check if the logged-in user's email matches the invitation email
    if (session.user.email !== invitation?.email) {
      toast.error('This invitation is for a different email address')
      return
    }

    setIsAccepting(true)

    try {
      // Check if user needs onboarding
      if (!session.user.onboardingCompleted) {
        // Redirect to onboarding with invitation
        await navigate({
          to: '/onboarding',
          search: { invite: invitationId }
        })
      } else {
        // User is already onboarded, accept invitation directly
        const result = await authClient.organization.acceptInvitation({
          invitationId
        })

        if (result.data) {
          // Get the organization ID from the result
          const organizationId = (result as any).organizationId || (result as any).data?.organizationId || result.data.organizationId

          // Set as active organization using utility function
          if (organizationId) {
            setActiveOrganizationId(organizationId)
          }

          // Force a session refetch to get updated organization list
          await refetchSession()
          await refetchOrganizations()

          toast.success(`Welcome to ${invitation?.organizationName}!`)

          // Small delay to ensure state updates propagate
          setTimeout(() => {
            navigate({ to: '/' })
          }, 100)
        } else {
          throw new Error('Failed to accept invitation')
        }
      }
    } catch (error) {
      console.error('Failed to accept invitation:', error)
      toast.error('Failed to accept invitation. Please try again.')
    } finally {
      setIsAccepting(false)
    }
  }

  if (sessionPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
        <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Invitation</h1>
          <p className="text-muted-foreground mb-6">
            This invitation link is invalid or has expired.
          </p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="px-6 py-2 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // Show OTP form if user needs to sign in
  if (showOTPForm && !session && invitation) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
        <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md">
          <OTPSignIn
            email={invitation.email}
            onSuccess={async () => {
              // Refetch session to get the updated authentication state
              const { data: newSession } = await refetchSession()

              if (newSession) {
                setShowOTPForm(false)

                // Check if user needs onboarding
                if (!newSession.user.onboardingCompleted) {
                  toast.success('Signed in! Please complete your profile to continue.')
                  // Redirect to onboarding with invitation
                  await navigate({
                    to: '/onboarding',
                    search: { invite: invitationId }
                  })
                } else {
                  // User is already onboarded, accept invitation directly
                  toast.success('Signed in! Accepting invitation...')

                  try {
                    const result = await authClient.organization.acceptInvitation({
                      invitationId
                    })

                    if (result.data) {
                      // Get the organization ID from the result
                      const organizationId = (result as any).organizationId || (result as any).data?.organizationId || result.data.organizationId

                      // Set as active organization using utility function
                      if (organizationId) {
                        setActiveOrganizationId(organizationId)
                      }

                      // Force a session refetch to get updated organization list
                      await refetchSession()
                      await refetchOrganizations()

                      toast.success(`Welcome to ${invitation.organizationName}!`)

                      // Small delay to ensure state updates propagate
                      setTimeout(() => {
                        navigate({ to: '/' })
                      }, 100)
                    } else {
                      throw new Error('Failed to accept invitation')
                    }
                  } catch (error) {
                    toast.error('Failed to accept invitation. Please try again.')
                    setShowOTPForm(false)
                  }
                }
              } else {
                toast.error('Authentication failed. Please try again.')
              }
            }}
            onBack={() => setShowOTPForm(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
      <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <UserPlus className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">You're Invited!</h1>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Organization</p>
              <p className="font-medium text-foreground">{invitation.organizationName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Invited by</p>
              <p className="font-medium text-foreground">{invitation.inviterName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium text-foreground capitalize">{invitation.role || 'Member'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {session ? (
            session.user.email === invitation.email ? (
              // User is logged in with the correct email
              <>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Signed in as <strong>{session.user.email}</strong>
                </p>
                <button
                  onClick={handleAcceptInvitation}
                  disabled={isAccepting}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAccepting ? 'Accepting...' : 'Accept Invitation'}
                </button>
                <button
                  onClick={() => authClient.signOut()}
                  className="w-full px-4 py-2 border border-input text-foreground font-medium rounded-lg hover:bg-accent"
                >
                  Sign in with Different Account
                </button>
              </>
            ) : (
              // User is logged in but with a different email
              <>
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                        This invitation is for another user
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        This invitation was sent to <strong>{invitation.email}</strong>, but you're signed in as <strong>{session.user.email}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await authClient.signOut()
                    // Reload the page to show the sign-in form
                    window.location.reload()
                  }}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90"
                >
                  Sign Out and Use Invitation
                </button>
                <button
                  onClick={() => navigate({ to: '/' })}
                  className="w-full px-4 py-2 border border-input text-foreground font-medium rounded-lg hover:bg-accent"
                >
                  Go to Home
                </button>
              </>
            )
          ) : (
            <>
              <button
                onClick={handleAcceptInvitation}
                className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90"
              >
                Get Access Code
              </button>
              <p className="text-sm text-muted-foreground text-center">
                We'll send a code to <strong>{invitation.email}</strong> to verify it's you
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}