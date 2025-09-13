/**
 * Main employee management exports
 * Only includes client-safe items to prevent server code bundling
 * For server functions, import from '@/lib/employees/server'
 */

// Re-export all client-safe items
export * from './client'

// Note: Server functions are available via '@/lib/employees/server'
// This prevents accidental server code bundling in client components