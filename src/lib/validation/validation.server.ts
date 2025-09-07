import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { and, eq, not } from 'drizzle-orm'
import { validationRules } from './validation-registry'
import { validationMessages as vm } from './validation-messages'
import { db } from '@/lib/db/db'
import { organization, user } from '@/database/schema'

/**
 * Server-side database constraint validator
 * This function runs only on the server and can access the database
 */
async function validateDatabaseConstraints(
  entity: 'organization' | 'user' | 'todo',
  field: string,
  value: any,
  context?: { excludeId?: string; organizationId?: string }
): Promise<true | string> {
  switch (entity) {
    case 'organization':
      if (field === 'slug') {
        const existing = await db.select()
          .from(organization)
          .where(and(
            eq(organization.slug, value),
            context?.excludeId ? not(eq(organization.id, context.excludeId)) : undefined
          ))
          .limit(1)
        
        if (existing.length > 0) {
          return vm.organization.slug.taken
        }
      }
      break
      
    case 'user':
      if (field === 'email') {
        const existing = await db.select()
          .from(user)
          .where(and(
            eq(user.email, value),
            context?.excludeId ? not(eq(user.id, context.excludeId)) : undefined
          ))
          .limit(1)
        
        if (existing.length > 0) {
          return vm.user.email.taken
        }
      }
      break
  }
  
  return true
}

/**
 * Server function for field validation (includes database checks)
 */
export const validateField = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({
    entity: z.string(),
    field: z.string(),
    value: z.any(),
    options: z.object({
      skipDatabase: z.boolean().optional(),
      context: z.object({
        excludeId: z.string().optional(),
        organizationId: z.string().optional()
      }).optional()
    }).optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const { entity, field, value, options } = data
    
    try {
      // 1. Zod validation first
      const entityRules = validationRules[entity as keyof typeof validationRules]
      if (entityRules) {
        const schema = (entityRules as any)[field]
        if (schema) {
          schema.parse(value)
        }
      }
      
      // 2. Database validation (if needed)
      if (!options?.skipDatabase) {
        const dbResult = await validateDatabaseConstraints(
          entity as 'organization' | 'user' | 'todo',
          field,
          value,
          options?.context
        )
        
        if (dbResult !== true) {
          return { valid: false, error: dbResult }
        }
      }
      
      return { valid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          valid: false, 
          error: error.issues[0]?.message || vm.common.validationFailed 
        }
      }
      return { valid: false, error: vm.common.validationFailed }
    }
  })

/**
 * Server function specifically for checking slug availability
 */
export const checkSlugAvailability = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({
    slug: z.string(),
    organizationId: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const validation = await validateDatabaseConstraints(
      'organization',
      'slug',
      data.slug,
      { excludeId: data.organizationId }
    )
    
    return { available: validation === true }
  })