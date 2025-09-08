import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import errorTranslations from '@/i18n/locales/en/errors.json'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { auth } from '@/lib/auth/auth'
import { validateOrganizationRole, getRoleOrder } from '@/lib/auth/auth-types'
import { db } from '@/lib/db/db'
import { member, invitation, user } from '@/database/schema'
import { checkPermission } from '@/lib/utils/permissions'
import { checkPlanLimitUtil } from '@/lib/utils/plan-limits'
import { ServerQueryParams, ServerQueryResponse } from '@/taali/components/data-table'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['viewer', 'member', 'admin', 'owner']),
  organizationId: z.string(),
})

const removeMemberSchema = z.object({
  memberIdOrEmail: z.string(),
  organizationId: z.string(),
})

const updateMemberRoleSchema = z.object({
  memberId: z.string(),
  role: z.enum(['viewer', 'member', 'admin', 'owner']),
  organizationId: z.string(),
})

const cancelInvitationSchema = z.object({
  invitationId: z.string(),
  organizationId: z.string(),
})

const resendInvitationSchema = z.object({
  invitationId: z.string(),
  organizationId: z.string(),
})

export type TeamMember = {
  id: string
  type: 'member' | 'invitation'
  email: string
  name: string | null
  role: string
  status: 'active' | 'pending'
  joinedAt: Date | null
  expiresAt: Date | null
  avatar: string | null
  userId: string | null
}

export const inviteTeamMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => inviteMemberSchema.parse(data))
  .handler(async ({ data }) => {
    await checkPermission('invitation', ['create'], data.organizationId)

    // Check plan limits before creating invitation
    const request = getWebRequest()
    const limitCheck = await checkPlanLimitUtil('members', 'create', data.organizationId, request.headers)

    if (!limitCheck.allowed) {
      throw new AppError(
        ERROR_CODES.BIZ_LIMIT_EXCEEDED,
        400,
        { resource: 'members' },
        limitCheck.reason || errorTranslations.codes.BIZ_LIMIT_EXCEEDED,
        [{ action: 'upgrade' }]
      )
    }

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(and(eq(member.organizationId, data.organizationId), eq(user.email, data.email)))
      .limit(1)

    if (existingMember.length > 0) {
      throw new AppError(
        ERROR_CODES.BIZ_DUPLICATE_ENTRY,
        400,
        { resource: 'member' },
        errorTranslations.server.alreadyMember
      )
    }

    // Check for existing pending invitation
    const existingInvite = await db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, data.organizationId),
          eq(invitation.email, data.email),
          eq(invitation.status, 'pending')
        )
      )
      .limit(1)

    if (existingInvite.length > 0) {
      throw new AppError(
        ERROR_CODES.BIZ_DUPLICATE_ENTRY,
        400,
        { resource: 'invitation' },
        errorTranslations.server.invitationAlreadySent
      )
    }

    // Create invitation using Better Auth API
    const result = await auth.api.createInvitation({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        email: data.email,
        role: data.role,
      },
    })

    if (!result) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        errorTranslations.server.invitationCreationFailed
      )
    }

    return result
  })

export const removeTeamMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => removeMemberSchema.parse(data))
  .handler(async ({ data }) => {
    await checkPermission('member', ['delete'], data.organizationId)

    const request = getWebRequest()

    const result = await auth.api.removeMember({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        memberIdOrEmail: data.memberIdOrEmail,
      },
    })

    if (!result) {
      throw new AppError(ERROR_CODES.SYS_SERVER_ERROR, 500, undefined, 'Failed to remove member')
    }

    return result
  })

export const updateTeamMemberRole = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => updateMemberRoleSchema.parse(data))
  .handler(async ({ data }) => {
    await checkPermission('member', ['update'], data.organizationId)

    const request = getWebRequest()

    // Prevent changing owner role
    const targetMember = await db.select().from(member).where(eq(member.id, data.memberId)).limit(1)

    if (targetMember[0]?.role === 'owner') {
      throw new AppError(
        ERROR_CODES.BIZ_INVALID_STATE,
        400,
        undefined,
        errorTranslations.server.cannotChangeOwnerRole
      )
    }

    const result = await auth.api.updateMemberRole({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        memberId: data.memberId,
        role: data.role,
      },
    })

    if (!result) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        errorTranslations.server.failedToUpdateRole
      )
    }

    return result
  })

export const cancelTeamInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => cancelInvitationSchema.parse(data))
  .handler(async ({ data }) => {
    await checkPermission('invitation', ['cancel'], data.organizationId)

    const request = getWebRequest()

    // Verify the invitation belongs to this organization
    const invite = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, data.invitationId))
      .limit(1)

    if (!invite[0] || invite[0].organizationId !== data.organizationId) {
      throw AppError.notFound('Invitation')
    }

    const result = await auth.api.cancelInvitation({
      headers: request.headers,
      body: {
        invitationId: data.invitationId,
      },
    })

    if (!result) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        errorTranslations.server.invitationCancellationFailed
      )
    }

    return result
  })

export const resendTeamInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => resendInvitationSchema.parse(data))
  .handler(async ({ data }) => {
    // Check both required permissions for resending
    await checkPermission('invitation', ['create'], data.organizationId)
    await checkPermission('invitation', ['cancel'], data.organizationId)

    const request = getWebRequest()

    // Verify the invitation belongs to this organization and get details
    const invite = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, data.invitationId))
      .limit(1)

    if (!invite[0] || invite[0].organizationId !== data.organizationId) {
      throw AppError.notFound('Invitation')
    }

    if (invite[0].status !== 'pending') {
      throw new AppError(
        ERROR_CODES.BIZ_INVALID_STATE,
        400,
        undefined,
        errorTranslations.server.onlyPendingInvitationsResent
      )
    }

    // Cancel the existing invitation
    const cancelResult = await auth.api.cancelInvitation({
      headers: request.headers,
      body: {
        invitationId: data.invitationId,
      },
    })

    if (!cancelResult) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        errorTranslations.server.failedToCancelInvitation
      )
    }

    // Create a new invitation with the same details
    const result = await auth.api.createInvitation({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        email: invite[0].email,
        role: validateOrganizationRole(invite[0].role),
      },
    })

    if (!result) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        errorTranslations.server.failedToCreateInvitation
      )
    }

    return result
  })

// DataTable-compatible server function
export const getTeamMembersTable = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => {
    // Only validate query params, organizationId comes from context
    const params = data as ServerQueryParams
    return params
  })
  .handler(async ({ data, context }) => {
    const organizationId = context.organizationId
    if (!organizationId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        errorTranslations.server.noOrganizationContext
      )
    }

    const pageIndex = data.pagination?.pageIndex ?? 0
    const pageSize = data.pagination?.pageSize ?? 10
    const offset = pageIndex * pageSize

    // Extract search from global search parameter
    const searchTerm = data.search || ''

    // Fetch members with user details
    const membersQuery = db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, organizationId))

    // Fetch invitations
    const invitationsQuery = db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        inviterName: user.name,
      })
      .from(invitation)
      .leftJoin(user, eq(invitation.inviterId, user.id))
      .where(
        and(eq(invitation.organizationId, organizationId), eq(invitation.status, 'pending'))
      )

    const [membersResult, invitationsResult] = await Promise.all([membersQuery, invitationsQuery])

    // Transform and merge data
    let teamMembers: TeamMember[] = [
      ...membersResult.map(m => ({
        id: m.id,
        type: 'member' as const,
        email: m.userEmail || '',
        name: m.userName,
        role: m.role || 'member',
        status: 'active' as const,
        joinedAt: m.createdAt,
        expiresAt: null,
        avatar: m.userImage,
        userId: m.userId,
      })),
      ...invitationsResult.map(i => ({
        id: i.id,
        type: 'invitation' as const,
        email: i.email,
        name: null,
        role: i.role || 'member',
        status: 'pending' as const,
        joinedAt: null,
        expiresAt: i.expiresAt,
        avatar: null,
        userId: null,
      })),
    ]

    // Apply filters
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      teamMembers = teamMembers.filter(
        member =>
          member.name?.toLowerCase().includes(searchLower) ||
          member.email.toLowerCase().includes(searchLower)
      )
    }

    // Apply role filter if specified
    if (data.filters?.role) {
      teamMembers = teamMembers.filter(member => member.role === data.filters!.role)
    }

    // Apply status filter if specified
    if (data.filters?.status) {
      teamMembers = teamMembers.filter(member => member.status === data.filters!.status)
    }

    // Apply sorting
    if (data.sorting && data.sorting.length > 0) {
      const sort = data.sorting[0]
      teamMembers.sort((a, b) => {
        let compareValue = 0

        switch (sort.id) {
          case 'name': {
            const aName = a.name || a.email
            const bName = b.name || b.email
            compareValue = aName.localeCompare(bName)
            break
          }
          case 'email':
            compareValue = a.email.localeCompare(b.email)
            break
          case 'role': {
            compareValue = getRoleOrder(a.role) - getRoleOrder(b.role)
            break
          }
          case 'status':
            compareValue = a.status.localeCompare(b.status)
            break
          case 'joinedAt': {
            const aDate = a.joinedAt || a.expiresAt || new Date(0)
            const bDate = b.joinedAt || b.expiresAt || new Date(0)
            compareValue = aDate.getTime() - bDate.getTime()
            break
          }
        }

        return sort.desc ? -compareValue : compareValue
      })
    }

    const totalCount = teamMembers.length
    const pageCount = Math.ceil(totalCount / pageSize)
    const paginatedMembers = teamMembers.slice(offset, offset + pageSize)

    const response: ServerQueryResponse<TeamMember> = {
      data: paginatedMembers,
      totalCount,
      pageCount,
    }

    return response
  })
