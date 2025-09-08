import { z } from 'zod'

import { validationRules } from './validation-registry'
import { validationMessages } from './validation-messages'

// User profile schema
export const userProfileSchema = z.object({
  firstName: validationRules.user.firstName,
  lastName: validationRules.user.lastName,
  email: validationRules.user.email
})

export type UserProfileData = z.infer<typeof userProfileSchema>

// User registration schema
export const userRegistrationSchema = z.object({
  firstName: validationRules.user.firstName,
  lastName: validationRules.user.lastName,
  email: validationRules.user.email,
  password: validationRules.user.password,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: validationMessages.common.passwordMatch,
  path: ["confirmPassword"]
})

export type UserRegistrationData = z.infer<typeof userRegistrationSchema>

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: validationRules.user.currentPassword,
  newPassword: validationRules.user.password,
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: validationMessages.common.passwordMatch,
  path: ["confirmPassword"]
})

export type PasswordChangeData = z.infer<typeof passwordChangeSchema>