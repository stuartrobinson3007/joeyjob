import { z } from 'zod'

import { validationMessages as vm } from './validation-messages'

// Type for field values that can be validated
type FieldValue = string | number | boolean | Date | null | undefined

// Single source of truth for all validations (CLIENT-SIDE ONLY)
export const validationRules = {
  organization: {
    name: z.string()
      .min(2, vm.organization.name.min(2))
      .max(100, vm.organization.name.max(100)),
    slug: z.string()
      .min(3, vm.organization.slug.min(3))
      .max(50, vm.organization.slug.max(50))
      .regex(/^[a-z0-9-]+$/, vm.organization.slug.pattern)
  },
  user: {
    email: z.string().email(vm.user.email.invalid),
    firstName: z.string()
      .min(1, vm.user.firstName.required)
      .max(50, vm.user.firstName.max),
    lastName: z.string()
      .min(1, vm.user.lastName.required)
      .max(50, vm.user.lastName.max),
    password: z.string()
      .min(8, vm.user.password.min(8))
      .regex(/[A-Z]/, vm.user.password.uppercase)
      .regex(/[a-z]/, vm.user.password.lowercase)
      .regex(/[0-9]/, vm.user.password.number),
    currentPassword: z.string()
      .min(1, vm.user.currentPassword.required)
  },
  todo: {
    title: z.string()
      .min(1, vm.todo.title.required)
      .max(200, vm.todo.title.max(200)),
    description: z.string()
      .max(5000, vm.todo.description.max(5000))
      .optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().datetime().optional()
  }
}

// Client-side validation function (Zod only, no database)
export function validateFieldClient(
  entity: string,
  field: string,
  value: FieldValue
): { valid: boolean; error?: string } {
  try {
    const entityRules = validationRules[entity as keyof typeof validationRules]
    if (entityRules) {
      const schema = (entityRules as Record<string, z.ZodSchema>)[field]
      if (schema) {
        schema.parse(value)
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
}