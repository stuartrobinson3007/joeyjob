import { createMiddleware } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { member } from '@/database/schema'

export const organizationMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware]) // Chain with auth middleware (which includes error handling)
  .client(async ({ next }) => {
    // Check sessionStorage first (tab-specific)
    let organizationId = typeof window !== 'undefined' ? sessionStorage.getItem('activeOrganizationId') : null
    
    // If no sessionStorage, check localStorage and set sessionStorage
    if (!organizationId && typeof window !== 'undefined') {
      const localOrgId = localStorage.getItem('activeOrganizationId')
      if (localOrgId) {
        sessionStorage.setItem('activeOrganizationId', localOrgId)
        organizationId = localOrgId
      }
    }

    return next({
      sendContext: {
        organizationId,
      },
    })
  })
  .server(async ({ next, context }) => {
    const request = getWebRequest()

    let validatedOrgId: string | null = null

    if (context.organizationId && context.user) {
      try {
        // Validate it's a string
        const orgId = z.string().parse(context.organizationId)

        // Verify user has access to this organization
        const membership = await db
          .select()
          .from(member)
          .where(and(eq(member.userId, context.user.id), eq(member.organizationId, orgId)))
          .limit(1)

        if (membership.length > 0) {
          validatedOrgId = orgId
        } else {
          // User is not a member of this organization - validatedOrgId stays null
        }
      } catch (_error) {
        // Log validation error but continue - user will see no active org
        // Organization validation failed, throw error for handling upstream
      }
    } else {
      // No organizationId or user - validatedOrgId stays null
    }

    return next({
      context: {
        ...context, // Preserve existing context from auth middleware
        organizationId: validatedOrgId,
        headers: request.headers, // Add headers for BetterAuth API calls
      },
    })
  })
