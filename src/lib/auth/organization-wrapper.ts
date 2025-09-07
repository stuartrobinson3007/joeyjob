import { authClient } from '@/lib/auth/auth-client'
import { ValidationError, AppError, ERROR_CODES } from '@/lib/utils/errors'
import { validationMessages as vm } from '@/lib/validation/validation-messages'
import { validateField } from '@/lib/validation/validation.server'

/**
 * Transform Better Auth errors to our AppError format
 */
function transformBetterAuthError(error: any): Error {
  // Check if Better Auth provides field information
  if (error?.field) {
    return new ValidationError({
      [error.field]: error.message || 'Invalid value'
    })
  }
  
  // Map common Better Auth errors to our error codes
  if (error?.message) {
    if (error.message.includes('already exists')) {
      return new AppError(ERROR_CODES.BIZ_DUPLICATE_ENTRY, 400, undefined, error.message)
    }
    if (error.message.includes('not found')) {
      return new AppError(ERROR_CODES.BIZ_NOT_FOUND, 404, undefined, error.message)
    }
    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return new AppError(ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS, 403, undefined, error.message)
    }
  }
  
  // Default to generic error
  return new AppError(
    ERROR_CODES.SYS_SERVER_ERROR,
    500,
    undefined,
    error?.message || 'Operation failed'
  )
}

/**
 * Update organization with validation
 */
export async function updateOrganizationWithValidation(data: {
  organizationId: string
  name: string
  slug: string
}) {
  // 1. Run our custom validations first
  const nameValidation = await validateField({
    data: {
      entity: 'organization',
      field: 'name',
      value: data.name,
      options: { skipDatabase: true }
    }
  })
  
  if (!nameValidation.valid) {
    throw new ValidationError({
      name: nameValidation.error || vm.organization.name.required
    })
  }
  
  const slugValidation = await validateField({
    data: {
      entity: 'organization',
      field: 'slug',
      value: data.slug,
      options: { context: { excludeId: data.organizationId } }
    }
  })
  
  if (!slugValidation.valid) {
    throw new ValidationError({
      slug: slugValidation.error || vm.organization.slug.required
    })
  }
  
  // 2. Call Better Auth
  const result = await authClient.organization.update({
    organizationId: data.organizationId,
    data: {
      name: data.name,
      slug: data.slug
    }
  })
  
  // 3. Transform Better Auth errors to our format
  if (result.error) {
    throw transformBetterAuthError(result.error)
  }
  
  return result.data
}

/**
 * Create organization with validation
 */
export async function createOrganizationWithValidation(data: {
  name: string
  slug: string
}) {
  // 1. Validate fields
  const nameValidation = await validateField({
    data: {
      entity: 'organization',
      field: 'name',
      value: data.name,
      options: { skipDatabase: true }
    }
  })
  
  if (!nameValidation.valid) {
    throw new ValidationError({
      name: nameValidation.error || vm.organization.name.required
    })
  }
  
  const slugValidation = await validateField({
    data: {
      entity: 'organization',
      field: 'slug',
      value: data.slug
    }
  })
  
  if (!slugValidation.valid) {
    throw new ValidationError({
      slug: slugValidation.error || vm.organization.slug.required
    })
  }
  
  // 2. Call Better Auth
  const result = await authClient.organization.create(data)
  
  // 3. Handle errors
  if (result.error) {
    throw transformBetterAuthError(result.error)
  }
  
  return result.data
}

/**
 * Check slug availability (delegate to server function)
 */
export { checkSlugAvailability } from '@/lib/validation/validation.server'

/**
 * Delete organization
 */
export async function deleteOrganizationWithValidation(organizationId: string) {
  const result = await authClient.organization.delete({
    organizationId
  })
  
  if (result.error) {
    throw transformBetterAuthError(result.error)
  }
  
  return result.data
}