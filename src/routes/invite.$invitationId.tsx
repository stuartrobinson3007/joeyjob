import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Building2, Mail, UserPlus, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useErrorHandler } from '@/lib/errors/hooks'
import { authClient } from '@/lib/auth/auth-client'
import { getInvitationDetails } from '@/features/organization/lib/onboarding.server'
import { OTPSignIn } from '@/features/auth/components/otp-sign-in'
import { useListOrganizations, useSession } from '@/lib/auth/auth-hooks'
import { setActiveOrganizationId } from '@/features/organization/lib/organization-utils'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export const Route = createFileRoute('/invite/$invitationId')({
  loader: async ({ params }) => {
    try {
      const invitation = await getInvitationDetails({
        data: { invitationId: params.invitationId },
      })
      return { invitation }
    } catch (error) {
      console.error('Failed to load invitation:', error)
      return { invitation: null }
    }
  },
  component: InvitationPage,
})

function InvitationPage() {
  const { invitationId } = Route.useParams()
  const { invitation } = Route.useLoaderData()
  const { showError, showSuccess } = useErrorHandler()
  const { data: session, isPending: sessionPending, refetch: refetchSession } = useSession()
  const { refetch: refetchOrganizations } = useListOrganizations()
  const navigate = useNavigate()
  const [isAccepting, setIsAccepting] = useState(false)
  const [showOTPForm, setShowOTPForm] = useState(false)
  const { t } = useTranslation('invitations')
  const { t: tCommon } = useTranslation('common')
  const { t: tNotifications } = useTranslation('notifications')

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
          type: 'sign-in',
        })
        showSuccess(t('common:messages.verificationSent'))
      } catch (error) {
        showError(error)
      }
      return
    }

    // Check if the logged-in user's email matches the invitation email
    if (session.user.email !== invitation?.email) {
      showError(t('common:messages.wrongEmail'))
      return
    }

    setIsAccepting(true)

    try {
      // Check if user needs onboarding
      if (!session.user.onboardingCompleted) {
        // Redirect to onboarding with invitation
        await navigate({
          to: '/onboarding',
          search: { invite: invitationId },
        })
      } else {
        // User is already onboarded, accept invitation directly
        const result = await authClient.organization.acceptInvitation({
          invitationId,
        })

        if (result.data) {
          // Get the organization ID from the result - check various possible locations
          const data = result.data as any
          const organizationId =
            data?.organizationId || data?.organization?.id || data?.member?.organizationId

          // Set as active organization using utility function
          if (organizationId) {
            setActiveOrganizationId(organizationId)
          }

          // Force a session refetch to get updated organization list
          await refetchSession()
          await refetchOrganizations()

          showSuccess(
            tNotifications('success.welcomeToOrganization', {
              organizationName: invitation?.organizationName,
            })
          )

          // Small delay to ensure state updates propagate
          setTimeout(() => {
            navigate({ to: '/' })
          }, 100)
        } else {
          throw new Error(t('common:messages.acceptInvitationFailed'))
        }
      }
    } catch (error) {
      console.error('Failed to accept invitation:', error)
      showError(error)
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
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('invalid')}</h1>
          <p className="text-muted-foreground mb-6">{t('common:messages.invalidOrExpired')}</p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="px-6 py-2 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80"
          >
            {tCommon('navigation.home')}
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
                  showSuccess(t('common:messages.signedInProfile'))
                  // Redirect to onboarding with invitation
                  await navigate({
                    to: '/onboarding',
                    search: { invite: invitationId },
                  })
                } else {
                  // User is already onboarded, accept invitation directly
                  showSuccess(t('common:messages.signedInAccepting'))

                  try {
                    const result = await authClient.organization.acceptInvitation({
                      invitationId,
                    })

                    if (result.data) {
                      // Get the organization ID from the result - check various possible locations
                      const data = result.data as any
                      const organizationId =
                        data?.organizationId ||
                        data?.organization?.id ||
                        data?.member?.organizationId

                      // Set as active organization using utility function
                      if (organizationId) {
                        setActiveOrganizationId(organizationId)
                      }

                      // Force a session refetch to get updated organization list
                      await refetchSession()
                      await refetchOrganizations()

                      toast.success(
                        tNotifications('success.welcomeToOrganization', {
                          organizationName: invitation.organizationName,
                        })
                      )

                      // Small delay to ensure state updates propagate
                      setTimeout(() => {
                        navigate({ to: '/' })
                      }, 100)
                    } else {
                      throw new Error(t('common:messages.acceptInvitationFailed'))
                    }
                  } catch (error) {
                    showError(error)
                    setShowOTPForm(false)
                  }
                }
              } else {
                showError(t('common:messages.authFailed'))
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
          <h1 className="text-2xl font-bold text-foreground">{t('common:messages.youreInvited')}</h1>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t('common:labels.organization')}</p>
              <p className="font-medium text-foreground">{invitation.organizationName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t('common:labels.invitedBy')}</p>
              <p className="font-medium text-foreground">{invitation.inviterName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t('common:labels.role')}</p>
              <p className="font-medium text-foreground capitalize">
                {invitation.role || t('common:labels.defaultRole')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {session ? (
            session.user.email === invitation.email ? (
              // User is logged in with the correct email
              <>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  {t('common:messages.signedInAs', { email: session.user.email })}
                </p>
                <button
                  onClick={handleAcceptInvitation}
                  disabled={isAccepting}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAccepting ? t('common:actions.accepting') : t('common:actions.accept')}
                </button>
                <button
                  onClick={() => authClient.signOut()}
                  className="w-full px-4 py-2 border border-input text-foreground font-medium rounded-lg hover:bg-accent"
                >
                  {t('common:actions.signInDifferent')}
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
                        {t('common:messages.wrongUser')}
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {t('common:messages.sentToDifferentEmail', {
                          invitationEmail: invitation.email,
                          currentEmail: session.user.email,
                        })}
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
                  {t('common:actions.signOutAndUse')}
                </button>
                <button
                  onClick={() => navigate({ to: '/' })}
                  className="w-full px-4 py-2 border border-input text-foreground font-medium rounded-lg hover:bg-accent"
                >
                  {tCommon('navigation.home')}
                </button>
              </>
            )
          ) : (
            <>
              <button
                onClick={handleAcceptInvitation}
                className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90"
              >
                {t('common:actions.getAccessCode')}
              </button>
              <p className="text-sm text-muted-foreground text-center">
                {t('common:messages.sendCodeVerification', { email: invitation.email })}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
