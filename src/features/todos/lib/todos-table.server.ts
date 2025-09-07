import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc, asc, count, like, ilike, inArray } from 'drizzle-orm'
import { z } from 'zod'

import errorTranslations from '@/i18n/locales/en/errors.json'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { db } from '@/lib/db/db'
import { todos, user } from '@/database/schema'
import {
  buildColumnFilter,
  buildSearchFilter,
  parseFilterValue,
  preprocessFilterValue,
} from '@/lib/utils/table-filters'
import { ServerQueryResponse } from '@/components/taali-ui/data-table'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/lib/errors/codes'

// Get todos with filtering, sorting, and pagination
export const getTodosTable = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        errorTranslations.server.noOrganizationContext
      )
    }

    // Default values if data is not provided
    const queryData = data || {}

    const {
      search = '',
      filters = {},
      sorting = [],
      pagination = { pageIndex: 0, pageSize: 10 },
    } = queryData

    // Build where conditions
    const conditions: any[] = [eq(todos.organizationId, orgId)]

    // Add search filter (searches title only since description can be null)
    if (search) {
      const searchFilter = buildSearchFilter([todos.title], search)
      if (searchFilter) conditions.push(searchFilter)
    }

    // Add column filters
    Object.entries(filters).forEach(([columnId, value]) => {
      if (value === undefined || value === null || columnId === '_search') return

      // Special handling for title filter which acts as search
      if (columnId === 'title' && typeof value === 'string') {
        const titleFilter = ilike(todos.title, `%${value}%`)
        conditions.push(titleFilter)
        return
      }

      // Parse the filter value to get operator and actual value
      const { operator, value: filterValue } = parseFilterValue(value)

      // Map column IDs to database columns
      const columnMap: Record<string, any> = {
        title: todos.title,
        description: todos.description,
        priority: todos.priority,
        completed: todos.completed,
        createdBy: todos.createdBy,
        createdByName: todos.createdBy, // Filter by user ID when filtering by name
        assignedTo: todos.assignedTo,
        dueDate: todos.dueDate,
        createdAt: todos.createdAt,
        updatedAt: todos.updatedAt,
      }

      const column = columnMap[columnId]
      if (column) {
        const processedValue = preprocessFilterValue(columnId, filterValue)

        const filter = buildColumnFilter({
          column,
          operator,
          value: processedValue,
        })
        if (filter) conditions.push(filter)
      }
    })

    // Build order by
    const orderBy =
      sorting.length > 0
        ? (sorting
            .map((sort: any) => {
              const columnMap: Record<string, any> = {
                title: todos.title,
                priority: todos.priority,
                completed: todos.completed,
                createdByName: user.name,
                dueDate: todos.dueDate,
                createdAt: todos.createdAt,
                updatedAt: todos.updatedAt,
              }
              const column = columnMap[sort.id]
              return column ? (sort.desc ? desc(column) : asc(column)) : null
            })
            .filter(Boolean) as any[])
        : [desc(todos.createdAt)]

    // Check if we need user join for filtering
    const needsUserJoin = Object.keys(filters).includes('createdByName')

    // Get total count for pagination
    let countQuery = db.select({ totalCount: count(todos.id) }).from(todos)
    if (needsUserJoin) {
      countQuery = countQuery.leftJoin(user, eq(todos.createdBy, user.id)) as any
    }
    const [{ totalCount }] = await countQuery.where(and(...conditions))

    // Get paginated data
    const { pageIndex, pageSize } = pagination
    const offset = pageIndex * pageSize

    const todoList = await db
      .select({
        id: todos.id,
        title: todos.title,
        description: todos.description,
        priority: todos.priority,
        completed: todos.completed,
        dueDate: todos.dueDate,
        createdAt: todos.createdAt,
        updatedAt: todos.updatedAt,
        createdBy: todos.createdBy,
        createdByName: user.name,
        assignedTo: todos.assignedTo,
        organizationId: todos.organizationId,
      })
      .from(todos)
      .leftJoin(user, eq(todos.createdBy, user.id))
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(offset)

    const response: ServerQueryResponse<(typeof todoList)[0]> = {
      data: todoList,
      totalCount,
      pageCount: Math.ceil(totalCount / pageSize),
    }

    return response
  })

// Get count of todos matching filters
export const getTodosTableCount = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        errorTranslations.server.noOrganizationContext
      )
    }

    const queryData = data || {}
    const { search = '', filters = {} } = queryData

    // Build where conditions (same logic as getTodosTable)
    const conditions: any[] = [eq(todos.organizationId, orgId)]

    // Add search filter
    if (search) {
      const searchFilter = buildSearchFilter([todos.title], search)
      if (searchFilter) conditions.push(searchFilter)
    }

    // Add column filters (same logic as getTodosTable)
    Object.entries(filters).forEach(([columnId, value]) => {
      if (value === undefined || value === null || columnId === '_search') return

      if (columnId === 'title' && typeof value === 'string') {
        const titleFilter = like(todos.title, `%${value}%`)
        conditions.push(titleFilter)
        return
      }

      const { operator, value: filterValue } = parseFilterValue(value)
      const columnMap: Record<string, any> = {
        title: todos.title,
        description: todos.description,
        priority: todos.priority,
        completed: todos.completed,
        createdBy: todos.createdBy,
        createdByName: todos.createdBy, // Filter by user ID when filtering by name
        assignedTo: todos.assignedTo,
        dueDate: todos.dueDate,
        createdAt: todos.createdAt,
        updatedAt: todos.updatedAt,
      }

      const column = columnMap[columnId]
      if (column) {
        let processedValue = filterValue
        if (columnId === 'completed') {
          processedValue = filterValue === 'true' || filterValue === true
        }

        const filter = buildColumnFilter({
          column,
          operator,
          value: processedValue,
        })
        if (filter) conditions.push(filter)
      }
    })

    // Check if we need user join for filtering
    const needsUserJoin = Object.keys(filters).includes('createdByName')

    // Get count
    let countQuery = db.select({ totalCount: count(todos.id) }).from(todos)
    if (needsUserJoin) {
      countQuery = countQuery.leftJoin(user, eq(todos.createdBy, user.id)) as any
    }
    const [{ totalCount }] = await countQuery.where(and(...conditions))

    return { totalCount }
  })

// Get all todo IDs matching filters (for select all functionality)
export const getAllTodosIds = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        errorTranslations.server.noOrganizationContext
      )
    }

    const queryData = data || {}
    const { search = '', filters = {} } = queryData

    // Build where conditions (same logic as getTodosTable)
    const conditions: any[] = [eq(todos.organizationId, orgId)]

    // Add search filter
    if (search) {
      const searchFilter = buildSearchFilter([todos.title], search)
      if (searchFilter) conditions.push(searchFilter)
    }

    // Add column filters (same logic as getTodosTable)
    Object.entries(filters).forEach(([columnId, value]) => {
      if (value === undefined || value === null || columnId === '_search') return

      if (columnId === 'title' && typeof value === 'string') {
        const titleFilter = like(todos.title, `%${value}%`)
        conditions.push(titleFilter)
        return
      }

      const { operator, value: filterValue } = parseFilterValue(value)
      const columnMap: Record<string, any> = {
        title: todos.title,
        description: todos.description,
        priority: todos.priority,
        completed: todos.completed,
        createdBy: todos.createdBy,
        createdByName: todos.createdBy, // Filter by user ID when filtering by name
        assignedTo: todos.assignedTo,
        dueDate: todos.dueDate,
        createdAt: todos.createdAt,
        updatedAt: todos.updatedAt,
      }

      const column = columnMap[columnId]
      if (column) {
        let processedValue = filterValue
        if (columnId === 'completed') {
          processedValue = filterValue === 'true' || filterValue === true
        }

        const filter = buildColumnFilter({
          column,
          operator,
          value: processedValue,
        })
        if (filter) conditions.push(filter)
      }
    })

    // Check if we need user join for filtering
    const needsUserJoin = Object.keys(filters).includes('createdByName')

    // Get all IDs (limit to reasonable number for safety)
    let idsQuery = db.select({ id: todos.id }).from(todos)
    if (needsUserJoin) {
      idsQuery = idsQuery.leftJoin(user, eq(todos.createdBy, user.id)) as any
    }
    const allIds = await idsQuery.where(and(...conditions)).limit(10000) // Safety limit

    return { ids: allIds.map(row => row.id) }
  })

// Schema for bulk delete - now simplified to just IDs
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()),
})

// Bulk delete todos
export const bulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        errorTranslations.server.noOrganizationContext
      )
    }

    const { ids } = bulkDeleteSchema.parse(data)

    if (!ids || ids.length === 0) {
      return { success: true, deletedCount: 0 }
    }

    // Delete specific IDs, but verify they belong to the organization
    await db.delete(todos).where(and(inArray(todos.id, ids), eq(todos.organizationId, orgId)))

    return { success: true, deletedCount: ids.length }
  })

// Get users who have created todos (for dynamic filter options)
export const getTodoCreators = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }: { context: any }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        errorTranslations.server.noOrganizationContext
      )
    }

    // Get distinct users who have created todos in this organization
    const creators = await db
      .select({
        value: user.id,
        label: user.name,
      })
      .from(todos)
      .innerJoin(user, eq(todos.createdBy, user.id))
      .where(eq(todos.organizationId, orgId))
      .groupBy(user.id, user.name)
      .orderBy(asc(user.name))

    return { options: creators }
  })
