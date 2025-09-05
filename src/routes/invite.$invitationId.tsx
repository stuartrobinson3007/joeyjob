import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { authClient } from '@/lib/auth/auth-client'
import { getInvitationDetails } from '@/features/organization/lib/onboarding.server'
import { OTPSignIn } from '@/features/auth/components/otp-sign-in'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Building2, Mail, UserPlus, AlertCircle } from 'lucide-react'
import { useSession } from '@/lib/auth/auth-hooks'

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
  const { data: session, isPending: sessionPending } = useSession()
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
          // Set as active organization
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('activeOrganizationId', (result as any).organizationId)
            localStorage.setItem('activeOrganizationId', (result as any).organizationId)
          }

          toast.success(`Welcome to ${invitation?.organizationName}!`)
          await navigate({ to: '/' })
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
        <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
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
            onSuccess={() => {
              setShowOTPForm(false)
              toast.success('Successfully signed in! You can now accept the invitation.')
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