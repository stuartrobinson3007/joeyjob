import { z } from 'zod'

import { validationRules } from './validation-registry'

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
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

export type UserRegistrationData = z.infer<typeof userRegistrationSchema>

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: validationRules.user.password,
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

export type PasswordChangeData = z.infer<typeof passwordChangeSchema>