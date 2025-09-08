/**
 * Server Query Validation Schemas
 * 
 * Provides proper Zod validation schemas for server function parameters
 * instead of using type assertions that bypass validation.
 */

import { z } from 'zod'

/**
 * Zod schema for ServerQueryParams validation
 * Replaces unsafe (data || {}) as ServerQueryParams casting
 */
export const serverQueryParamsSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sorting: z.array(z.object({
    id: z.string(),
    desc: z.boolean()
  })).optional(),
  pagination: z.object({
    pageIndex: z.number().int().min(0),
    pageSize: z.number().int().min(1).max(1000)
  }).optional()
}).optional()

/**
 * Transform and validate server query params
 * Provides sensible defaults for optional fields
 */
export function validateServerQueryParams(data: unknown) {
  const parsed = serverQueryParamsSchema.parse(data || {})
  
  return {
    search: parsed?.search ?? '',
    filters: parsed?.filters ?? {},
    sorting: parsed?.sorting ?? [],
    pagination: parsed?.pagination ?? { pageIndex: 0, pageSize: 10 }
  }
}

/**
 * Simplified schema for endpoints that only need basic params
 */
export const basicQueryParamsSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional()
}).optional()

export function validateBasicQueryParams(data: unknown) {
  const parsed = basicQueryParamsSchema.parse(data || {})
  
  return {
    search: parsed?.search ?? '',
    filters: parsed?.filters ?? {}
  }
}