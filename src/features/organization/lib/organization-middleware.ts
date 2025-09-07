import { createMiddleware } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { member } from '@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

export const organizationMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])  // Chain with auth middleware to get user context
  .client(async ({ next }) => {
    // Read organizationId from sessionStorage (tab-specific)
    const organizationId = typeof window !== 'undefined' 
      ? sessionStorage.getItem('activeOrganizationId')
      : null
    
    
    return next({
      sendContext: {
        organizationId
      }
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
          .where(and(
            eq(member.userId, context.user.id),
            eq(member.organizationId, orgId)
          ))
          .limit(1)
        
        
        if (membership.length > 0) {
          validatedOrgId = orgId
        } else {
        }
      } catch (error) {
      }
    } else {
    }


    return next({
      context: {
        ...context,  // Preserve existing context from auth middleware
        organizationId: validatedOrgId,
        headers: request.headers  // Add headers for BetterAuth API calls
      }
    })
  })