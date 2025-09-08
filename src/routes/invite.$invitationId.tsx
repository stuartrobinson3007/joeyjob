import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Building2, Mail, UserPlus, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Trans } from 'react-i18next'

import { useErrorHandler } from '@/lib/errors/hooks'
import { authClient } from '@/lib/auth/auth-client'
import { AppError, ERROR_CODES } from '@/lib/utils/errors'
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
    } catch (_error) {
      // Failed to load invitation - error handled by UI state
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
        showSuccess(t('messages.verificationSent'))
      } catch (error) {
        showError(error)
      }
      return
    }

    // Check if the logged-in user's email matches the invitation email
    if (session.user.email !== invitation?.email) {
      showError(t('messages.wrongEmail'))
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
          const data = result.data as { organizationId?: string; organization?: { id?: string }; member?: { organizationId?: string } }
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
          throw new AppError(
            ERROR_CODES.BIZ_INVALID_STATE,
            400,
            { invitationId },
            t('messages.acceptInvitationFailed')
          )
        }
      }
    } catch (error) {
      // Failed to accept invitation - error handled by showError
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
          <p className="text-muted-foreground mb-6">{t('messages.invalidOrExpired')}</p>
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
                  // Redirect to onboarding with invitation
                  await navigate({
                    to: '/onboarding',
                    search: { invite: invitationId },
                  })
                } else {
                  // User is already onboarded, accept invitation directly
                  try {
                    const result = await authClient.organization.acceptInvitation({
                      invitationId,
                    })

                    if (result.data) {
                      // Get the organization ID from the result - check various possible locations
                      const data = result.data as { organizationId?: string; organization?: { id?: string }; member?: { organizationId?: string } }
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
                      throw new AppError(
            ERROR_CODES.BIZ_INVALID_STATE,
            400,
            { invitationId },
            t('messages.acceptInvitationFailed')
          )
                    }
                  } catch (error) {
                    showError(error)
                    setShowOTPForm(false)
                  }
                }
              } else {
                showError(t('messages.authFailed'))
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
          <h1 className="text-2xl font-bold text-foreground">{t('messages.youreInvited')}</h1>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t('labels.organization')}</p>
              <p className="font-medium text-foreground">{invitation.organizationName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t('labels.invitedBy')}</p>
              <p className="font-medium text-foreground">{invitation.inviterName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t('labels.role')}</p>
              <p className="font-medium text-foreground capitalize">
                {invitation.role || t('labels.defaultRole')}
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
                  {t('messages.signedInAs', { email: session.user.email })}
                </p>
                <button
                  onClick={handleAcceptInvitation}
                  disabled={isAccepting}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAccepting ? t('actions.accepting') : t('actions.accept')}
                </button>
                <button
                  onClick={() => authClient.signOut()}
                  className="w-full px-4 py-2 border border-input text-foreground font-medium rounded-lg hover:bg-accent"
                >
                  {t('actions.signInDifferent')}
                </button>
              </>
            ) : (
              // User is logged in but with a different email
              <>
                <div className="bg-warning/10 dark:bg-warning/20 border border-warning/20 dark:border-warning/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-warning mb-1">
                        {t('messages.wrongUser')}
                      </p>
                      <p className="text-sm text-warning/80">
                        {t('messages.sentToDifferentEmail', {
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
                  {t('actions.signOutAndUse')}
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
                {t('actions.getAccessCode')}
              </button>
              <p className="text-sm text-muted-foreground text-center">
                <Trans
                  ns="invitations"
                  i18nKey="messages.sendCodeVerification"
                  values={{ email: invitation.email }}
                  components={{ strong: <strong /> }}
                />
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
