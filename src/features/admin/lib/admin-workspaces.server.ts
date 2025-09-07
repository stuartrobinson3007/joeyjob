import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { organization, member } from '@/database/schema'
import { ilike, desc, asc, count, or, eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { buildColumnFilter, parseFilterValue, preprocessFilterValue } from '@/lib/utils/table-filters'
import { ServerQueryResponse } from '@/components/taali-ui/data-table'

export type AdminWorkspace = {
  id: string
  name: string
  slug: string | null
  createdAt: string
  memberCount?: number
}

// Schema for query params validation
const queryParamsSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.string(), z.any()).optional(),
  sorting: z.array(z.object({
    id: z.string(),
    desc: z.boolean()
  })).optional(),
  pagination: z.object({
    pageIndex: z.number(),
    pageSize: z.number()
  }).optional()
})

export const getAdminWorkspacesTable = createServerFn({ method: 'POST' })
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
      
      // Build base query with member count
      let workspacesQuery = db.select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        memberCount: count(member.id)
      })
      .from(organization)
      .leftJoin(member, eq(member.organizationId, organization.id))
      .groupBy(organization.id, organization.name, organization.slug, organization.createdAt)

      // Apply search filter with SQL
      const conditions = []
      if (searchTerm) {
        conditions.push(
          or(
            ilike(organization.name, `%${searchTerm}%`),
            ilike(organization.slug, `%${searchTerm}%`),
            ilike(organization.id, `%${searchTerm}%`)
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
            case 'createdAt':
              column = organization.createdAt
              break
            default:
              return
          }
          
          const processedValue = preprocessFilterValue(columnId, filterValue)
          const filter = buildColumnFilter({
            column,
            operator,
            value: processedValue
          })
          if (filter) {
            conditions.push(filter)
          }
        })
      }

      // Add conditions to query
      if (conditions.length > 0) {
        workspacesQuery = workspacesQuery.where(and(...conditions)) as any
      }

      // Apply sorting with SQL
      if (data.sorting && data.sorting.length > 0) {
        const sort = data.sorting[0]
        const sortFn = sort.desc ? desc : asc
        
        switch (sort.id) {
          case 'id':
            workspacesQuery = workspacesQuery.orderBy(sortFn(organization.id)) as any
            break
          case 'organization':
          case 'name':
            workspacesQuery = workspacesQuery.orderBy(sortFn(organization.name)) as any
            break
          case 'createdAt':
            workspacesQuery = workspacesQuery.orderBy(sortFn(organization.createdAt)) as any
            break
          case 'memberCount':
            workspacesQuery = workspacesQuery.orderBy(sortFn(count(member.id))) as any
            break
        }
      } else {
        // Default sort by created date
        workspacesQuery = workspacesQuery.orderBy(desc(organization.createdAt)) as any
      }

      // Get total count for pagination (need separate query since we have groupBy)
      let totalCountQuery = db.select({ count: count(organization.id) }).from(organization)
      if (conditions.length > 0) {
        totalCountQuery = totalCountQuery.where(and(...conditions)) as any
      }

      // Execute queries in parallel
      const [workspacesResult, totalCountResult] = await Promise.all([
        workspacesQuery.limit(pageSize).offset(offset),
        totalCountQuery
      ])


      // Transform to our format
      const transformedWorkspaces: AdminWorkspace[] = workspacesResult.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.createdAt.toISOString(),
        memberCount: Number(org.memberCount) || 0
      }))

      const totalCount = Number(totalCountResult[0]?.count || 0)
      const pageCount = Math.ceil(totalCount / pageSize)

      const response: ServerQueryResponse<AdminWorkspace> = {
        data: transformedWorkspaces,
        totalCount,
        pageCount
      }


      return response
    } catch (error) {
      console.error('[getAdminWorkspacesTable] Error loading workspaces:', error)
      return {
        data: [],
        totalCount: 0,
        pageCount: 0
      }
    }
  })

export const getAdminWorkspaceStats = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    try {
      // Get total organizations count
      const totalOrgsResult = await db.select({ count: count(organization.id) }).from(organization)
      
      // Get total members count across all organizations
      const totalMembersResult = await db.select({ count: count(member.id) }).from(member)
      
      const totalOrgs = Number(totalOrgsResult[0]?.count || 0)
      const totalMembers = Number(totalMembersResult[0]?.count || 0)
      const avgMembersPerOrg = totalOrgs > 0 ? Math.round(totalMembers / totalOrgs) : 0
      
      return {
        totalOrganizations: totalOrgs,
        totalMembers: totalMembers,
        avgMembersPerOrg: avgMembersPerOrg
      }
    } catch (error) {
      console.error('[getAdminWorkspaceStats] Error loading workspace stats:', error)
      return {
        totalOrganizations: 0,
        totalMembers: 0,
        avgMembersPerOrg: 0
      }
    }
  })