import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// Schema for password validation
const passwordSchema = z.object({ 
  password: z.string().min(1, 'Password is required') 
})

// Server-side only password validation for superadmin access
export const validateSuperadminPassword = createServerFn({ method: 'POST' })
  .validator((data: unknown) => passwordSchema.parse(data || {}))
  .handler(async ({ data, context }) => {
    // Access server-side environment variable (no VITE_ prefix)
    const correctPassword = process.env.SUPERADMIN_ACCESS_PASSWORD
    
    if (!correctPassword) {
      throw new Error('Superadmin access not configured on server')
    }
    
    // Simple comparison for now
    // In production, consider adding:
    // - Rate limiting (e.g., max 5 attempts per hour per IP)
    // - IP allowlist
    // - Audit logging
    // - Temporary lockout after failed attempts
    const isValid = data.password === correctPassword
    
    if (!isValid) {
      // Log failed attempt (in production, include IP address)
      
      // Generic error message to avoid revealing whether password exists
      return { 
        valid: false,
        error: 'Invalid password' 
      }
    }
    
    // Log successful access (in production, include IP and timestamp)
    
    return { 
      valid: true,
      error: null 
    }
  })