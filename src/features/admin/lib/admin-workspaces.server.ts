import { createServerFn } from '@tanstack/react-start'
import { ilike, desc, asc, count, or, eq, and } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { z } from 'zod'

import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { organization, member, user } from '@/database/schema'
import { AppError } from '@/lib/utils/errors'
import { buildColumnFilter, parseFilterValue, preprocessFilterValue } from '@/lib/utils/table-filters'
import { ServerQueryResponse } from '@/taali/components/data-table'

export type AdminWorkspace = {
  id: string
  name: string
  slug: string | null
  createdAt: string
  memberCount?: number
  ownerId?: string | null
  ownerName?: string | null
  ownerBanned?: boolean | null
  currentPlan?: string | null
  stripeCustomerId?: string | null
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
      
      // Build base query - get all organizations first, then get owner info
      // Step 1: Get all organizations with member count
      let workspacesQuery = db.select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        currentPlan: organization.currentPlan,
        stripeCustomerId: organization.stripeCustomerId,
        memberCount: count(member.id)
      })
      .from(organization)
      .leftJoin(member, eq(member.organizationId, organization.id))
      .groupBy(organization.id, organization.name, organization.slug, organization.createdAt, organization.currentPlan, organization.stripeCustomerId)
      .$dynamic()

      // Apply search filter with SQL
      const conditions = []
      if (searchTerm) {
        conditions.push(
          or(
            ilike(organization.name, `%${searchTerm}%`),
            ilike(organization.slug, `%${searchTerm}%`),
            ilike(organization.id, `%${searchTerm}%`),
            ilike(organization.stripeCustomerId, `%${searchTerm}%`)
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
          let column: PgColumn | undefined
          switch (columnId) {
            case 'createdAt':
              column = organization.createdAt
              break
            case 'currentPlan':
              column = organization.currentPlan
              break
            case 'stripeCustomerId':
              column = organization.stripeCustomerId
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
        workspacesQuery = workspacesQuery.where(and(...conditions))
      }

      // Apply sorting with SQL
      if (data.sorting && data.sorting.length > 0) {
        const sort = data.sorting[0]
        const sortFn = sort.desc ? desc : asc
        
        switch (sort.id) {
          case 'id':
            workspacesQuery = workspacesQuery.orderBy(sortFn(organization.id))
            break
          case 'organization':
          case 'name':
            workspacesQuery = workspacesQuery.orderBy(sortFn(organization.name))
            break
          case 'createdAt':
            workspacesQuery = workspacesQuery.orderBy(sortFn(organization.createdAt))
            break
          case 'memberCount':
            workspacesQuery = workspacesQuery.orderBy(sortFn(count(member.id)))
            break
          case 'currentPlan':
            workspacesQuery = workspacesQuery.orderBy(sortFn(organization.currentPlan))
            break
          case 'stripeCustomerId':
            workspacesQuery = workspacesQuery.orderBy(sortFn(organization.stripeCustomerId))
            break
        }
      } else {
        // Default sort by created date
        workspacesQuery = workspacesQuery.orderBy(desc(organization.createdAt))
      }

      // Get total count for pagination (need separate query since we have groupBy)
      let totalCountQuery = db.select({ count: count(organization.id) }).from(organization).$dynamic()
      if (conditions.length > 0) {
        totalCountQuery = totalCountQuery.where(and(...conditions))
      }

      // Execute queries in parallel
      const [workspacesResult, totalCountResult] = await Promise.all([
        workspacesQuery.limit(pageSize).offset(offset),
        totalCountQuery
      ])


      // Step 2: Get owner information for each organization
      const orgIds = workspacesResult.map(org => org.id)
      const ownerInfoMap = new Map()
      
      if (orgIds.length > 0) {
        const ownerRecords = await db.select({
          organizationId: member.organizationId,
          ownerId: user.id,
          ownerName: user.name,
          ownerBanned: user.banned
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(
          and(
            eq(member.role, 'owner'),
            eq(member.organizationId, orgIds[0]) // We'll do this per org for now
          )
        )


        // Create a map for quick lookup
        ownerRecords.forEach(owner => {
          ownerInfoMap.set(owner.organizationId, {
            ownerId: owner.ownerId,
            ownerName: owner.ownerName,
            ownerBanned: owner.ownerBanned
          })
        })

        // DEBUG: Get owner info for each org individually
        for (const org of workspacesResult) {
          const ownerInfo = await db.select({
            ownerId: user.id,
            ownerName: user.name,
            ownerBanned: user.banned
          })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(
            and(
              eq(member.organizationId, org.id),
              eq(member.role, 'owner')
            )
          )
          .limit(1)

          if (ownerInfo.length > 0) {
            ownerInfoMap.set(org.id, ownerInfo[0])
          } else {
            // Check what members exist
            await db.select({
              userId: member.userId,
              role: member.role,
              userName: user.name
            })
            .from(member)
            .leftJoin(user, eq(user.id, member.userId))
            .where(eq(member.organizationId, org.id))
            
          }
        }
      }

      // Transform to our format using owner info map
      const transformedWorkspaces: AdminWorkspace[] = workspacesResult.map((org) => {
        const ownerInfo = ownerInfoMap.get(org.id)
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          createdAt: org.createdAt.toISOString(),
          memberCount: Number(org.memberCount) || 0,
          ownerId: ownerInfo?.ownerId || null,
          ownerName: ownerInfo?.ownerName || null,
          ownerBanned: ownerInfo?.ownerBanned || null,
          currentPlan: org.currentPlan || 'free',
          stripeCustomerId: org.stripeCustomerId || null
        }
      })

      const totalCount = Number(totalCountResult[0]?.count || 0)
      const pageCount = Math.ceil(totalCount / pageSize)

      const response: ServerQueryResponse<AdminWorkspace> = {
        data: transformedWorkspaces,
        totalCount,
        pageCount
      }


      return response
    } catch (_error) {
      // Return empty result on error
      return {
        data: [],
        totalCount: 0,
        pageCount: 0
      }
    }
  })

export const getAdminWorkspaceStats = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Verify user has superadmin role
    if (context.user.role !== 'superadmin') {
      throw AppError.forbidden('Superadmin access required')
    }

    try {
      // Get total organizations count
      const totalOrgsResult = await db.select({ count: count(organization.id) }).from(organization)
      
      // Get organizations count by plan
      const freeOrgsResult = await db.select({ count: count(organization.id) })
        .from(organization)
        .where(eq(organization.currentPlan, 'free'))
      
      const proOrgsResult = await db.select({ count: count(organization.id) })
        .from(organization)
        .where(eq(organization.currentPlan, 'pro'))
      
      const businessOrgsResult = await db.select({ count: count(organization.id) })
        .from(organization)
        .where(eq(organization.currentPlan, 'business'))
      
      const totalOrgs = Number(totalOrgsResult[0]?.count || 0)
      const freeOrgs = Number(freeOrgsResult[0]?.count || 0)
      const proOrgs = Number(proOrgsResult[0]?.count || 0)
      const businessOrgs = Number(businessOrgsResult[0]?.count || 0)
      
      return {
        totalOrganizations: totalOrgs,
        freeOrganizations: freeOrgs,
        proOrganizations: proOrgs,
        businessOrganizations: businessOrgs
      }
    } catch (_error) {
      // Return zero stats on error
      return {
        totalOrganizations: 0,
        freeOrganizations: 0,
        proOrganizations: 0,
        businessOrganizations: 0
      }
    }
  })