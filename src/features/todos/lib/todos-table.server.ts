import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc, asc, count, like, ilike, inArray, isNull, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import errorTranslations from '@/i18n/locales/en/errors.json'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { checkPlanLimitUtil } from '@/lib/utils/plan-limits'
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
import { validateServerQueryParams } from '@/lib/utils/server-query-schemas'


// Get todos with filtering, sorting, and pagination
export const getTodosTable = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(validateServerQueryParams)
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        errorTranslations.server.noOrganizationContext
      )
    }

    // Data is now properly validated and has defaults applied
    const { search, filters, sorting, pagination } = data

    // Build where conditions
    const conditions: SQL[] = [eq(todos.organizationId, orgId), isNull(todos.deletedAt)]

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
      const columnMap: Record<string, PgColumn> = {
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
          .map((sort: { id: string; desc?: boolean }) => {
            const columnMap: Record<string, PgColumn> = {
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
          .filter((item): item is NonNullable<typeof item> => item !== null))
        : [desc(todos.createdAt)]

    // Check if we need user join for filtering
    const needsUserJoin = Object.keys(filters).includes('createdByName')

    // Get total count for pagination
    const countQuery = needsUserJoin
      ? db.select({ totalCount: count(todos.id) }).from(todos).leftJoin(user, eq(todos.createdBy, user.id)).where(and(...conditions))
      : db.select({ totalCount: count(todos.id) }).from(todos).where(and(...conditions))

    const [{ totalCount }] = await countQuery

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

// Get all todo IDs matching filters (for select all functionality)
export const getAllTodosIds = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(validateServerQueryParams)
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        errorTranslations.server.noOrganizationContext
      )
    }

    const { search, filters } = data

    // Build where conditions (same logic as getTodosTable)
    const conditions: SQL[] = [eq(todos.organizationId, orgId), isNull(todos.deletedAt)]

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
      const columnMap: Record<string, PgColumn> = {
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
    const idsQuery = needsUserJoin
      ? db.select({ id: todos.id }).from(todos).leftJoin(user, eq(todos.createdBy, user.id)).where(and(...conditions)).limit(10000)
      : db.select({ id: todos.id }).from(todos).where(and(...conditions)).limit(10000)

    const allIds = await idsQuery

    return { ids: allIds.map(row => row.id) }
  })

// Schema for bulk delete - now simplified to just IDs
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()),
})

// Bulk delete todos
export const bulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => bulkDeleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        errorTranslations.server.noOrganizationContext
      )
    }

    if (!data.ids || data.ids.length === 0) {
      return { success: true, deletedCount: 0 }
    }

    // Soft delete specific IDs, but verify they belong to the organization
    await db
      .update(todos)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(inArray(todos.id, data.ids), eq(todos.organizationId, orgId), isNull(todos.deletedAt)))

    return {
      success: true,
      deletedCount: data.ids.length,
      canUndo: true,
      deletedIds: data.ids
    }
  })

// Get users who have created todos (for dynamic filter options)
export const getTodoCreators = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
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
      .where(and(eq(todos.organizationId, orgId), isNull(todos.deletedAt)))
      .groupBy(user.id, user.name)
      .orderBy(asc(user.name))

    return { options: creators }
  })

// Bulk undo operation
export const undoBulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        errorTranslations.server.noOrganizationContext
      )
    }

    // Check permissions - use create since we're restoring data
    await checkPermission('todos', ['create'], orgId)

    // First, count how many todos can actually be restored (exist and are deleted)
    const restorableCount = await db
      .select({ count: count(todos.id) })
      .from(todos)
      .where(and(
        inArray(todos.id, data.ids),
        eq(todos.organizationId, orgId),
        isNotNull(todos.deletedAt)
      ))

    const todosToRestore = restorableCount[0]?.count || 0

    if (todosToRestore === 0) {
      return {
        success: true,
        restoredCount: 0,
        restored: []
      }
    }

    // Check if restoring these todos would exceed plan limits
    // We need to check current active todos + todos to restore vs limit
    const currentActiveCount = await db
      .select({ count: count(todos.id) })
      .from(todos)
      .where(and(
        eq(todos.organizationId, orgId),
        isNull(todos.deletedAt)
      ))

    const activeCount = currentActiveCount[0]?.count || 0
    const totalAfterRestore = activeCount + todosToRestore

    // Use the plan limit utility to get the current limit
    const limitCheck = await checkPlanLimitUtil('todos', 'create', orgId, context.headers)

    // For bulk operations, we need to check against the total count after restore
    if (limitCheck.allowed && limitCheck.usage) {
      const { limit } = limitCheck.usage
      if (limit !== -1 && totalAfterRestore > limit) {
        throw new AppError(
          ERROR_CODES.BIZ_LIMIT_EXCEEDED,
          400,
          { resource: 'todos' },
          `Restoring ${todosToRestore} todos would exceed your plan limit of ${limit}. You currently have ${activeCount} active todos.`,
          [{ action: 'upgrade' }]
        )
      }
    } else if (!limitCheck.allowed) {
      // If the basic limit check failed, use that error
      throw new AppError(
        ERROR_CODES.BIZ_LIMIT_EXCEEDED,
        400,
        { resource: 'todos' },
        limitCheck.reason || errorTranslations.codes.BIZ_LIMIT_EXCEEDED,
        [{ action: 'upgrade' }]
      )
    }

    // Restore multiple records
    const restored = await db
      .update(todos)
      .set({
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(and(
        inArray(todos.id, data.ids),
        eq(todos.organizationId, orgId),
        isNotNull(todos.deletedAt)
      ))
      .returning()

    return {
      success: true,
      restoredCount: restored.length,
      restored: restored
    }
  })
