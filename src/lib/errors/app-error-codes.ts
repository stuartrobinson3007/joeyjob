// Application-specific error codes
// These are business logic errors specific to this application
export const APP_ERROR_CODES = {
  // Form-specific errors
  BIZ_FORM_NOT_FOUND: 'BIZ_FORM_NOT_FOUND',
} as const

export type AppErrorCode = (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES]

// Helper to check if a string is a valid app error code
export function isAppErrorCode(code: string): code is AppErrorCode {
  return Object.values(APP_ERROR_CODES).includes(code as AppErrorCode)
}