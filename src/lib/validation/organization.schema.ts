import { z } from 'zod'

import { validationRules } from './validation-registry'

// Create organization schema from validation rules
export const organizationFormSchema = z.object({
  name: validationRules.organization.name,
  slug: validationRules.organization.slug,
  timezone: validationRules.organization.timezone
})

export type OrganizationFormData = z.infer<typeof organizationFormSchema>

// Schema for updating organization (includes ID)
export const updateOrganizationSchema = organizationFormSchema.extend({
  organizationId: z.string().uuid()
})

export type UpdateOrganizationData = z.infer<typeof updateOrganizationSchema>

// Schema for creating organization
export const createOrganizationSchema = organizationFormSchema

export type CreateOrganizationData = z.infer<typeof createOrganizationSchema>