import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { authMiddleware } from '@/lib/auth/auth-middleware'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { member } from '@/database/schema'
import { AppError } from '@/lib/utils/errors'

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'admin', 'owner']),
  organizationId: z.string(),
})

const removeMemberSchema = z.object({
  memberIdOrEmail: z.string(),
  organizationId: z.string(),
})

const updateMemberRoleSchema = z.object({
  memberId: z.string(),
  role: z.enum(['member', 'admin', 'owner']),
  organizationId: z.string(),
})

// Invite a member to organization
export const inviteMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => inviteMemberSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = getWebRequest()

    // Validate membership for the specified organization
    const membership = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, context.user.id), eq(member.organizationId, data.organizationId))
      )
      .limit(1)

    if (!membership.length) {
      throw AppError.forbidden('access organization')
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

    return result
  })

// Remove a member from organization
export const removeMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => removeMemberSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = getWebRequest()

    // Validate membership for the specified organization
    const membership = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, context.user.id), eq(member.organizationId, data.organizationId))
      )
      .limit(1)

    if (!membership.length) {
      throw AppError.forbidden('access organization')
    }

    const result = await auth.api.removeMember({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        memberIdOrEmail: data.memberIdOrEmail,
      },
    })

    return result
  })

// Update member role
export const updateMemberRole = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => updateMemberRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = getWebRequest()

    // Validate membership for the specified organization
    const membership = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, context.user.id), eq(member.organizationId, data.organizationId))
      )
      .limit(1)

    if (!membership.length) {
      throw AppError.forbidden('access organization')
    }

    const result = await auth.api.updateMemberRole({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        memberId: data.memberId,
        role: data.role,
      },
    })

    return result
  })
