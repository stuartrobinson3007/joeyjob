import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { account } from '@/database/schema'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import { validationRules } from '@/lib/validation/validation-registry'

const completeOnboardingSchema = z.object({
  firstName: validationRules.user.firstName,
  lastName: validationRules.user.lastName,
})

export const completeOnboarding = createServerFn({ method: 'POST' })
  .validator((data: unknown) => completeOnboardingSchema.parse(data))
  .handler(async ({ data }) => {
    const request = getWebRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
      throw new AppError(
        ERROR_CODES.AUTH_NOT_AUTHENTICATED,
        401,
        undefined,
        'Authentication required'
      )
    }

    const userId = session.user.id

    // Check if user has OAuth account (Simpro/provider connection)
    const oauthAccounts = await db
      .select({
        providerId: account.providerId,
      })
      .from(account)
      .where(eq(account.userId, userId))

    const hasOAuthAccount = oauthAccounts.length > 0
    const isSimproUser = oauthAccounts.some(acc => acc.providerId === 'simpro')

    // All users complete onboarding immediately
    // Organization-level subscription checks happen separately
    const shouldCompleteOnboarding = true

    // Update user profile
    await auth.api.updateUser({
      headers: request.headers,
      body: {
        firstName: data.firstName,
        lastName: data.lastName,
        onboardingCompleted: shouldCompleteOnboarding,
        name: `${data.firstName} ${data.lastName}`.trim(),
      },
    })

    // No workspace creation or invitation handling in JoeyJob
    // Users will select their organization after onboarding

    return {
      success: true,
      isOAuthUser: hasOAuthAccount,
      userType: isSimproUser ? 'simpro' : hasOAuthAccount ? 'oauth' : 'regular',
    }
  })

export const getInvitationDetails = createServerFn({ method: 'GET' })
  .validator((data: unknown) => z.object({ invitationId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    // Query invitation details directly from database (no auth required for public invitation links)
    const invitationData = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
        organizationName: organization.name,
        inviterName: user.name,
      })
      .from(invitation)
      .leftJoin(organization, eq(invitation.organizationId, organization.id))
      .leftJoin(user, eq(invitation.inviterId, user.id))
      .where(
        and(
          eq(invitation.id, data.invitationId),
          eq(invitation.status, 'pending'),
          gt(invitation.expiresAt, new Date())
        )
      )
      .limit(1)

    if (!invitationData[0]) {
      throw new AppError(
        ERROR_CODES.BIZ_NOT_FOUND,
        404,
        { invitationId: data.invitationId },
        errorTranslations.server.invitationNotFoundOrExpired
      )
    }

    return {
      id: invitationData[0].id,
      email: invitationData[0].email,
      role: invitationData[0].role,
      organizationName: invitationData[0].organizationName || errorTranslations.fields.organization,
      inviterName: invitationData[0].inviterName || errorTranslations.server.defaultInviterName,
      expiresAt: invitationData[0].expiresAt,
      status: invitationData[0].status,
    }
  })
