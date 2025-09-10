import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql, isNull, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { db } from '@/lib/db/db'
import { bookingForms, organization } from '@/database/schema'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'

// Utility function to generate slugs
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    || 'form' // Fallback if empty
}

// Validation schemas
const createFormSchema = z.object({
  name: z.string().min(1, 'Form name is required').default('Untitled Form'),
  description: z.string().optional().default(''),
}).default({
  name: 'Untitled Form',
  description: '',
})

const updateFormSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  formConfig: z.any().optional(), // Form editor configuration JSON
  theme: z.enum(['light', 'dark']).optional(),
  primaryColor: z.string().optional(),
  isActive: z.boolean().optional(),
})


const deleteFormSchema = z.object({
  id: z.string(),
})

// Create a new form (like createTodo pattern)
export const createForm = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => {
    console.log('📝 createForm validator received:', data)
    try {
      const result = createFormSchema.parse(data || {})
      console.log('📝 createForm validation successful:', result)
      return result
    } catch (error) {
      console.error('❌ createForm validation failed:', error)
      throw error
    }
  })
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context
    console.log('📝 createForm handler received:', { data, organizationId, userId: user.id })
    
    // No permission checks needed - organization middleware ensures user is member

    try {
      console.log('📝 Creating default form configuration...')
      // Create default form configuration
      const defaultConfig = {
        serviceTree: {
          id: 'root',
          type: 'start',
          label: 'Book your service',
          children: []
        },
        baseQuestions: [
          {
            id: 'contact-info-field',
            name: 'contact_info',
            label: 'Contact Information',
            type: 'contact-info',
            fieldConfig: {
              firstNameRequired: true,
              lastNameRequired: true,
              emailRequired: true,
              phoneRequired: true,
              companyRequired: false
            }
          }
        ],
        theme: 'light',
        primaryColor: '#3B82F6'
      }

      console.log('📝 Generating slug and inserting form into database...')
      const baseSlug = generateSlug(data.name)
      const slug = baseSlug + '-' + Date.now().toString(36) // Add timestamp to ensure uniqueness
      
      const form = await db
        .insert(bookingForms)
        .values({
          organizationId,
          name: data.name,
          slug: slug,
          description: data.description || null,
          formConfig: defaultConfig,
          theme: 'light',
          primaryColor: '#3B82F6',
          isActive: false, // Start as inactive until configured
          isDefault: false,
          createdBy: user.id,
        })
        .returning()

      console.log('📝 Form created successfully:', form[0])
      return form[0]
    } catch (error) {
      console.error('❌ Database operation failed:', error)
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to create form'
      )
    }
  })

// Update form (auto-save pattern)
export const updateForm = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => updateFormSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context
    
    // No permission checks needed - organization middleware ensures user is member

    try {
      // Check if form exists and belongs to organization
      const existingForm = await db
        .select()
        .from(bookingForms)
        .where(and(
          eq(bookingForms.id, data.id),
          eq(bookingForms.organizationId, organizationId),
          isNull(bookingForms.deletedAt)
        ))
        .limit(1)

      if (!existingForm.length) {
        throw AppError.notFound('Form')
      }

      // Prepare update data
      const updateData: any = { updatedAt: new Date() }
      if (data.name !== undefined) updateData.name = data.name
      if (data.slug !== undefined) updateData.slug = data.slug
      if (data.description !== undefined) updateData.description = data.description
      if (data.formConfig !== undefined) updateData.formConfig = data.formConfig
      if (data.theme !== undefined) updateData.theme = data.theme
      if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor
      if (data.isActive !== undefined) updateData.isActive = data.isActive

      const updatedForm = await db
        .update(bookingForms)
        .set(updateData)
        .where(eq(bookingForms.id, data.id))
        .returning()
      
      return updatedForm[0]
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to update form'
      )
    }
  })

// Get single form by ID  
export const getForm = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => {
    console.log('📝 getForm validator received:', data)
    // Handle both object and string inputs
    if (typeof data === 'string') {
      return { id: data }
    }
    const result = z.object({ id: z.string() }).parse(data || {})
    console.log('📝 getForm validation result:', result)
    return result
  })
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context
    
    // No permission checks needed - organization middleware ensures user is member

    try {
      const form = await db
        .select()
        .from(bookingForms)
        .where(and(
          eq(bookingForms.id, data.id),
          eq(bookingForms.organizationId, organizationId),
          isNull(bookingForms.deletedAt)
        ))
        .limit(1)

      if (!form.length) {
        throw AppError.notFound('Form')
      }

      return form[0]
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to fetch form'
      )
    }
  })

// Delete form (soft delete)
export const deleteForm = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => deleteFormSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context
    
    try {
      // Check if form exists and belongs to organization
      const existingForm = await db
        .select()
        .from(bookingForms)
        .where(and(
          eq(bookingForms.id, data.id),
          eq(bookingForms.organizationId, organizationId),
          isNull(bookingForms.deletedAt)
        ))
        .limit(1)

      if (!existingForm.length) {
        throw AppError.notFound('Form')
      }

      // Soft delete: set deletedAt timestamp instead of hard delete
      await db
        .update(bookingForms)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq(bookingForms.id, data.id), eq(bookingForms.organizationId, organizationId)))

      return { success: true }
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to delete form'
      )
    }
  })

// Undo delete form (restore from soft delete)
export const undoDeleteForm = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => deleteFormSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context
    
    try {
      // Check if form exists and is soft-deleted (belongs to organization)
      const existingForm = await db
        .select()
        .from(bookingForms)
        .where(and(
          eq(bookingForms.id, data.id),
          eq(bookingForms.organizationId, organizationId),
          isNotNull(bookingForms.deletedAt)
        ))
        .limit(1)

      if (!existingForm.length) {
        throw AppError.notFound('Deleted Form')
      }

      // Restore by clearing deletedAt timestamp
      const restored = await db
        .update(bookingForms)
        .set({
          deletedAt: null,
          updatedAt: new Date()
        })
        .where(and(eq(bookingForms.id, data.id), eq(bookingForms.organizationId, organizationId)))
        .returning()

      return restored[0]
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to restore form'
      )
    }
  })

// Duplicate form
export const duplicateForm = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => deleteFormSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context
    
    try {
      // Check if form exists and belongs to organization
      const existingForm = await db
        .select()
        .from(bookingForms)
        .where(and(
          eq(bookingForms.id, data.id),
          eq(bookingForms.organizationId, organizationId),
          isNull(bookingForms.deletedAt)
        ))
        .limit(1)

      if (!existingForm.length) {
        throw AppError.notFound('Form')
      }

      const original = existingForm[0]
      
      // Generate new slug for the duplicate
      const baseSlug = generateSlug(`copy-of-${original.name}`)
      const slug = baseSlug + '-' + Date.now().toString(36)
      
      // Create duplicate with new name and slug
      const duplicated = await db
        .insert(bookingForms)
        .values({
          organizationId,
          name: `Copy of ${original.name}`,
          slug: slug,
          description: original.description,
          formConfig: original.formConfig,
          theme: original.theme,
          primaryColor: original.primaryColor,
          fields: original.fields, // Legacy compatibility
          serviceId: original.serviceId, // Legacy compatibility
          isActive: false, // Start as inactive
          isDefault: false, // Never duplicate as default
          createdBy: user.id,
        })
        .returning()

      return duplicated[0]
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to duplicate form'
      )
    }
  })

// Alias for getForm to match naming convention
export const getFormById = getForm

// Get all booking forms with pagination and filtering
export const getBookingForms = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => {
    const schema = z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
      isActive: z.boolean().optional(),
    }).default({})
    
    if (!data || typeof data !== 'object') {
      return schema.parse({})
    }
    return schema.parse(data)
  })
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    
    try {
      // Build where conditions - exclude soft-deleted forms
      const conditions = [
        eq(bookingForms.organizationId, organizationId),
        isNull(bookingForms.deletedAt)
      ]
      
      if (data.isActive !== undefined) {
        conditions.push(eq(bookingForms.isActive, data.isActive))
      }
      
      if (data.search) {
        conditions.push(
          // Search in name and description
          sql`${bookingForms.name} ILIKE ${`%${data.search}%`} OR ${bookingForms.description} ILIKE ${`%${data.search}%`}`
        )
      }
      
      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(bookingForms)
        .where(and(...conditions))
      
      const totalCount = Number(countResult[0]?.count || 0)
      
      // Get forms with pagination
      const forms = await db
        .select()
        .from(bookingForms)
        .where(and(...conditions))
        .orderBy(bookingForms.updatedAt)
        .limit(data.limit)
        .offset(data.offset)
      
      return {
        forms: forms.map(form => ({
          form,
          service: null, // Legacy compatibility - service relationship is now in formConfig
        })),
        pagination: {
          limit: data.limit,
          offset: data.offset,
          total: totalCount,
          hasMore: data.offset + data.limit < totalCount,
        },
      }
    } catch (error) {
      console.error('❌ getBookingForms failed:', error)
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to fetch forms'
      )
    }
  })
// Get public booking form (no auth required)
export const getBookingForm = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const schema = z.object({
      id: z.string(),
    })
    return schema.parse(data)
  })
  .handler(async ({ data }) => {
    // This is for the public booking form - no organization middleware needed
    const form = await db
      .select()
      .from(bookingForms)
      .where(and(
        eq(bookingForms.id, data.id),
        eq(bookingForms.isActive, true),
        isNull(bookingForms.deletedAt)
      ))
      .limit(1)

    if (!form.length) {
      throw new AppError(
        ERROR_CODES.BIZ_FORM_NOT_FOUND,
        404,
        undefined,
        'Booking form not found or inactive'
      )
    }

    return {
      form: form[0],
      service: null // Legacy compatibility
    }
  })

// Get public booking form by organization slug and form slug (no auth required)
export const getBookingFormBySlug = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const schema = z.object({
      orgSlug: z.string(),
      formSlug: z.string(),
    })
    return schema.parse(data)
  })
  .handler(async ({ data }) => {
    // Join with organization table to get form by slugs
    // First, let's check if the form exists at all
    const formCheck = await db
      .select()
      .from(bookingForms)
      .where(eq(bookingForms.slug, data.formSlug))
      .limit(1)
    
    console.log('🔍 Form check:', {
      formExists: formCheck.length > 0,
      formSlug: data.formSlug,
      isActive: formCheck[0]?.isActive,
      organizationId: formCheck[0]?.organizationId
    })

    if (formCheck.length > 0) {
      // Check the organization
      const orgCheck = await db
        .select()
        .from(organization)
        .where(eq(organization.id, formCheck[0].organizationId))
        .limit(1)
      
      console.log('🔍 Organization check:', {
        orgExists: orgCheck.length > 0,
        orgSlug: orgCheck[0]?.slug,
        expectedOrgSlug: data.orgSlug,
        orgName: orgCheck[0]?.name
      })
    }

    const result = await db
      .select({
        form: bookingForms,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo
        }
      })
      .from(bookingForms)
      .innerJoin(organization, eq(bookingForms.organizationId, organization.id))
      .where(and(
        eq(organization.slug, data.orgSlug),
        eq(bookingForms.slug, data.formSlug),
        eq(bookingForms.isActive, true),
        isNull(bookingForms.deletedAt)
      ))
      .limit(1)

    if (!result.length) {
      throw new AppError(
        ERROR_CODES.BIZ_FORM_NOT_FOUND,
        404,
        undefined,
        'Booking form not found or inactive'
      )
    }

    return {
      form: result[0].form,
      organization: result[0].organization,
      service: null // Legacy compatibility
    }
  })

export const validateFormFields = async () => ({ 
  isValid: true, 
  errors: [] 
})