import { createServerFn } from '@tanstack/react-start'
import { ilike, desc, asc, count, or, eq, and } from 'drizzle-orm'
import { z } from 'zod'

import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { user } from '@/database/schema'
import {
  buildColumnFilter,
  parseFilterValue,
  preprocessFilterValue,
} from '@/lib/utils/table-filters'
import { ServerQueryResponse } from '@/components/taali-ui/data-table'

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
  filters: z.record(z.string(), z.any()).optional(),
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
  .handler(async ({ data }) => {
    // TODO: Add proper admin permission check here

    const pageIndex = data.pagination?.pageIndex ?? 0
    const pageSize = data.pagination?.pageSize ?? 10
    const offset = pageIndex * pageSize
    const searchTerm = data.search || ''

    try {
      // Use direct database query for proper server-side performance

      // Build base query
      let query = db
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

      // Apply search filter with SQL
      const conditions: any[] = []
      if (searchTerm) {
        conditions.push(
          or(
            ilike(user.email, `%${searchTerm}%`),
            ilike(user.name, `%${searchTerm}%`),
            ilike(user.id, `%${searchTerm}%`)
          )
        )
      }

      // Apply column filters using helper functions
      if (data.filters) {
        Object.entries(data.filters).forEach(([columnId, value]) => {
          if (value === undefined || value === null) return

          // Parse the filter value to get operator and actual value
          const { operator, value: filterValue } = parseFilterValue(value)

          // Map column IDs to database columns
          let column: any
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

          const processedValue = preprocessFilterValue(columnId, filterValue)
          const filter = buildColumnFilter({
            column,
            operator,
            value: processedValue,
          })
          if (filter) {
            conditions.push(filter)
          }
        })
      }

      // Apply conditions and sorting
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any
      }

      // Apply sorting with SQL
      if (data.sorting && data.sorting.length > 0) {
        const sort = data.sorting[0]
        const sortFn = sort.desc ? desc : asc

        switch (sort.id) {
          case 'id':
            query = query.orderBy(sortFn(user.id)) as any
            break
          case 'user':
          case 'name':
            query = query.orderBy(sortFn(user.name)) as any
            break
          case 'email':
            query = query.orderBy(sortFn(user.email)) as any
            break
          case 'role':
            query = query.orderBy(sortFn(user.role)) as any
            break
          case 'status':
            query = query.orderBy(sortFn(user.banned)) as any
            break
          case 'createdAt':
            query = query.orderBy(sortFn(user.createdAt)) as any
            break
        }
      } else {
        // Default sort by created date
        query = query.orderBy(desc(user.createdAt)) as any
      }

      // Get total count for pagination
      let totalCountQuery = db.select({ count: count(user.id) }).from(user)
      // Apply same filters to count query
      if (conditions.length > 0) {
        totalCountQuery = totalCountQuery.where(and(...conditions)) as any
      }

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
        role: (user.role as 'user' | 'admin' | 'superadmin') || 'user',
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

      console.log('[getAdminUsersTable] Final response:', {
        dataCount: transformedUsers.length,
        totalCount,
        pageCount,
        sampleUser: transformedUsers[0],
      })

      return response
    } catch (error) {
      console.error('[getAdminUsersTable] Error loading users:', error)
      return {
        data: [],
        totalCount: 0,
        pageCount: 0,
      }
    }
  })

export const getAdminUserStats = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
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
    } catch (error) {
      console.error('[getAdminUserStats] Error loading user stats:', error)
      return {
        totalUsers: 0,
        activeUsers: 0,
        bannedUsers: 0,
      }
    }
  })
