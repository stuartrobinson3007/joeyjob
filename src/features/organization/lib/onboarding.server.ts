import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { and, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import { nanoid } from 'nanoid'

import errorTranslations from '@/i18n/locales/en/errors.json'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { invitation, organization, user, account } from '@/database/schema'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import { validationRules } from '@/lib/validation/validation-registry'

const completeOnboardingSchema = z.object({
  firstName: validationRules.user.firstName,
  lastName: validationRules.user.lastName,
  invitationId: z.string().optional(),
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

    // For OAuth users (like Simpro), complete user onboarding immediately
    // For regular users, keep it false until payment is complete
    const shouldCompleteOnboarding = hasOAuthAccount

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

    let organizationId: string

    if (data.invitationId) {
      // Accept invitation instead of creating organization
      const result = await auth.api.acceptInvitation({
        headers: request.headers,
        body: {
          invitationId: data.invitationId,
        },
      })

      if (!result || !result.invitation.organizationId) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { invitationId: data.invitationId },
          errorTranslations.server.failedToAcceptInvitation
        )
      }

      organizationId = result.invitation.organizationId
    } else if (hasOAuthAccount) {
      // OAuth users (like Simpro) don't need a personal workspace
      // Their organizations are created during OAuth setup
      // Return a placeholder - the user will select their organization next
      organizationId = 'oauth-user'
    } else {
      // Create personal workspace for regular users
      const slug = `${data.firstName.toLowerCase()}-workspace-${nanoid(8)}`
      const org = await auth.api.createOrganization({
        headers: request.headers,
        body: {
          name: `${data.firstName}'s Workspace`,
          slug,
        },
      })

      if (!org || !org.id) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          500,
          { organizationName: `${data.firstName}'s Workspace` },
          errorTranslations.server.failedToCreateOrganization
        )
      }

      organizationId = org.id
    }

    return {
      success: true,
      organizationId,
      isInvite: !!data.invitationId,
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
