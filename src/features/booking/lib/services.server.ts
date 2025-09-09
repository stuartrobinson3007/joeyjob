import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { nanoid } from 'nanoid'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { db } from '@/lib/db/db'
import { services } from '@/database/schema'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'

// Validation schemas
const createServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(100, 'Service name too long'),
  description: z.string().optional(),
  category: z.string().optional(),
  duration: z.number().min(15, 'Duration must be at least 15 minutes').max(480, 'Duration cannot exceed 8 hours'),
  price: z.number().min(0, 'Price cannot be negative'),
  isActive: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  maxAdvanceBookingDays: z.number().min(1).max(365).default(30),
  minAdvanceBookingHours: z.number().min(0).max(168).default(24),
  bufferTimeBefore: z.number().min(0).max(120).default(0),
  bufferTimeAfter: z.number().min(0).max(120).default(0),
})

const updateServiceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Service name is required').max(100, 'Service name too long').optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  duration: z.number().min(15).max(480).optional(),
  price: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  maxAdvanceBookingDays: z.number().min(1).max(365).optional(),
  minAdvanceBookingHours: z.number().min(0).max(168).optional(),
  bufferTimeBefore: z.number().min(0).max(120).optional(),
  bufferTimeAfter: z.number().min(0).max(120).optional(),
})

const deleteServiceSchema = z.object({
  id: z.string(),
})

const getServiceSchema = z.object({
  id: z.string(),
})

// Get all services for organization
export const getServices = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const { organizationId } = context
    
    try {
      const result = await db.select().from(services)
        .where(eq(services.organizationId, organizationId))
        .orderBy(services.name)
      
      return result
    } catch (error) {
      console.error('❌ getServices failed:', error)
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to fetch services'
      )
    }
  })

// Get single service by ID
export const getService = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => getServiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    
    try {
      const result = await db.select().from(services)
        .where(and(
          eq(services.id, data.id),
          eq(services.organizationId, organizationId)
        ))
        .limit(1)
      
      if (!result.length) {
        throw AppError.notFound('Service')
      }
      
      return result[0]
    } catch (error) {
      if (error instanceof AppError) throw error
      console.error('❌ getService failed:', error)
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to fetch service'
      )
    }
  })

// Create new service
export const createService = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createServiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context
    
    try {
      const service = await db.insert(services).values({
        id: nanoid(),
        ...data,
        organizationId,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning()
      
      return service[0]
    } catch (error) {
      console.error('❌ createService failed:', error)
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to create service'
      )
    }
  })

// Update existing service
export const updateService = createServerFn({ method: 'PUT' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => updateServiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    const { id, ...updates } = data
    
    try {
      // Verify service belongs to organization
      const existing = await db.select().from(services)
        .where(and(
          eq(services.id, id),
          eq(services.organizationId, organizationId)
        ))
        .limit(1)
      
      if (!existing.length) {
        throw AppError.notFound('Service')
      }
      
      const updated = await db.update(services)
        .set({ 
          ...updates, 
          updatedAt: new Date() 
        })
        .where(eq(services.id, id))
        .returning()
      
      return updated[0]
    } catch (error) {
      if (error instanceof AppError) throw error
      console.error('❌ updateService failed:', error)
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to update service'
      )
    }
  })

// Delete service
export const deleteService = createServerFn({ method: 'DELETE' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => deleteServiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    
    try {
      // Verify service belongs to organization
      const existing = await db.select().from(services)
        .where(and(
          eq(services.id, data.id),
          eq(services.organizationId, organizationId)
        ))
        .limit(1)
      
      if (!existing.length) {
        throw AppError.notFound('Service')
      }
      
      await db.delete(services).where(eq(services.id, data.id))
      
      return { success: true }
    } catch (error) {
      if (error instanceof AppError) throw error
      console.error('❌ deleteService failed:', error)
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to delete service'
      )
    }
  })