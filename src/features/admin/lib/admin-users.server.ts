import { createServerFn } from '@tanstack/react-start'
import { ilike, desc, asc, count, or, eq, and, SQL } from 'drizzle-orm'
import { PgColumn } from 'drizzle-orm/pg-core'
import { z } from 'zod'

import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { user } from '@/database/schema'
import { validateSystemRole } from '@/lib/auth/auth-types'
import { AppError } from '@/lib/utils/errors'
import {
  buildColumnFilter,
  parseFilterValue,
  preprocessFilterValue,
} from '@/lib/utils/table-filters'
import { ServerQueryResponse } from '@/taali/components/data-table'

export type AdminUser = {
  id: string
  name: string | null
  email: string
  role: 'user' | 'admin' | 'superadmin'
  banned: boolean
  createdAt: string
  emailVerified: boolean
}

// Schema for query params validation
const queryParamsSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sorting: z
    .array(
      z.object({
        id: z.string(),
        desc: z.boolean(),
      })
    )
    .optional(),
  pagination: z
    .object({
      pageIndex: z.number(),
      pageSize: z.number(),
    })
    .optional(),
})

export const getAdminUsersTable = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => {
    return queryParamsSchema.parse(data)
  })
  .handler(async ({ data, context }) => {
    // Verify user has superadmin role
    if (context.user.role !== 'superadmin') {
      throw AppError.forbidden('Superadmin access required')
    }

    const pageIndex = data.pagination?.pageIndex ?? 0
    const pageSize = data.pagination?.pageSize ?? 10
    const offset = pageIndex * pageSize
    const searchTerm = data.search || ''

    try {
      // Use direct database query for proper server-side performance

      // Build all conditions first
      const conditions: SQL[] = []
      if (searchTerm) {
        const searchCondition = or(
          ilike(user.email, `%${searchTerm}%`),
          ilike(user.name, `%${searchTerm}%`),
          ilike(user.id, `%${searchTerm}%`)
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
      }

      // Apply column filters using helper functions
      if (data.filters) {
        Object.entries(data.filters).forEach(([columnId, value]) => {
          if (value === undefined || value === null) return

          // Parse the filter value to get operator and actual value
          const { operator, value: filterValue } = parseFilterValue(value)

          // Map column IDs to database columns
          let column: PgColumn | undefined
          switch (columnId) {
            case 'role':
              column = user.role
              break
            case 'status':
              column = user.banned
              break
            case 'createdAt':
              column = user.createdAt
              break
            default:
              return
          }

          if (column) {
            const processedValue = preprocessFilterValue(columnId, filterValue)
            const filter = buildColumnFilter({
              column,
              operator,
              value: processedValue,
            })
            if (filter) {
              conditions.push(filter)
            }
          }
        })
      }

      // Build sorting configuration
      let orderBy
      if (data.sorting && data.sorting.length > 0) {
        const sort = data.sorting[0]
        const sortFn = sort.desc ? desc : asc

        switch (sort.id) {
          case 'id':
            orderBy = sortFn(user.id)
            break
          case 'user':
          case 'name':
            orderBy = sortFn(user.name)
            break
          case 'email':
            orderBy = sortFn(user.email)
            break
          case 'role':
            orderBy = sortFn(user.role)
            break
          case 'status':
            orderBy = sortFn(user.banned)
            break
          case 'createdAt':
            orderBy = sortFn(user.createdAt)
            break
        }
      } else {
        // Default sort by created date
        orderBy = desc(user.createdAt)
      }

      // Build complete query in one chain
      const baseQuery = db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
          createdAt: user.createdAt,
          emailVerified: user.emailVerified,
        })
        .from(user)

      const query = conditions.length > 0 
        ? baseQuery.where(and(...conditions)).orderBy(orderBy!)
        : baseQuery.orderBy(orderBy!)

      // Build count query in one chain
      const totalCountQuery = conditions.length > 0
        ? db.select({ count: count(user.id) }).from(user).where(and(...conditions))
        : db.select({ count: count(user.id) }).from(user)

      // Execute queries in parallel
      const [usersResult, totalCountResult] = await Promise.all([
        query.limit(pageSize).offset(offset),
        totalCountQuery,
      ])

      // Transform to our format
      const transformedUsers: AdminUser[] = usersResult.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: validateSystemRole(user.role),
        banned: !!user.banned,
        createdAt: user.createdAt.toISOString(),
        emailVerified: !!user.emailVerified,
      }))

      const totalCount = Number(totalCountResult[0]?.count || 0)
      const pageCount = Math.ceil(totalCount / pageSize)

      const response: ServerQueryResponse<AdminUser> = {
        data: transformedUsers,
        totalCount,
        pageCount,
      }


      return response
    } catch (_error) {
      // Return empty result on error
      return {
        data: [],
        totalCount: 0,
        pageCount: 0,
      }
    }
  })

export const getAdminUserStats = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Verify user has superadmin role
    if (context.user.role !== 'superadmin') {
      throw AppError.forbidden('Superadmin access required')
    }

    try {
      // Get total users count
      const totalUsersResult = await db.select({ count: count(user.id) }).from(user)

      // Get active users count (not banned)
      const activeUsersResult = await db
        .select({ count: count(user.id) })
        .from(user)
        .where(eq(user.banned, false))

      // Get banned users count
      const bannedUsersResult = await db
        .select({ count: count(user.id) })
        .from(user)
        .where(eq(user.banned, true))

      return {
        totalUsers: Number(totalUsersResult[0]?.count || 0),
        activeUsers: Number(activeUsersResult[0]?.count || 0),
        bannedUsers: Number(bannedUsersResult[0]?.count || 0),
      }
    } catch (_error) {
      // Return zero stats on error
      return {
        totalUsers: 0,
        activeUsers: 0,
        bannedUsers: 0,
      }
    }
  })
