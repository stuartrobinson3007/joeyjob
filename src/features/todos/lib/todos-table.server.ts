import { createServerFn } from '@tanstack/react-start'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'
import { eq, and, desc, asc, count, like, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { buildColumnFilter, buildSearchFilter, parseFilterValue } from '@/lib/utils/table-filters'
import { ServerQueryParams, ServerQueryResponse } from '@/components/data-table/types'

// Schema for query params
const queryParamsSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.any()).optional(),
  sorting: z.array(z.object({
    id: z.string(),
    desc: z.boolean()
  })).optional(),
  pagination: z.object({
    pageIndex: z.number(),
    pageSize: z.number()
  }).optional()
})

// Get todos with filtering, sorting, and pagination
export const getTodosTable = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new Error('No organization ID in context')
    }
    
    // Default values if data is not provided
    const queryData = data || {}
    
    const { 
      search = '', 
      filters = {}, 
      sorting = [], 
      pagination = { pageIndex: 0, pageSize: 10 } 
    } = queryData

    // Build where conditions
    const conditions: any[] = [eq(todos.organizationId, orgId)]

    // Add search filter (searches title only since description can be null)
    if (search) {
      const searchFilter = buildSearchFilter(
        [todos.title], 
        search
      )
      if (searchFilter) conditions.push(searchFilter)
    }

    // Add column filters
    Object.entries(filters).forEach(([columnId, value]) => {
      if (value === undefined || value === null || columnId === '_search') return

      // Special handling for title filter which acts as search
      if (columnId === 'title' && typeof value === 'string') {
        const titleFilter = like(todos.title, `%${value}%`)
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
        assignedTo: todos.assignedTo,
        dueDate: todos.dueDate,
        createdAt: todos.createdAt,
        updatedAt: todos.updatedAt,
      }

      const column = columnMap[columnId]
      if (column) {
        // Special handling for boolean completed field
        let processedValue = filterValue
        if (columnId === 'completed') {
          processedValue = filterValue === 'true' || filterValue === true
        }
        
        // Debug date values
        if (columnId === 'dueDate' || columnId === 'createdAt') {
          console.log(`[DATE_FILTER] ${columnId}:`, {
            originalValue: value,
            operator,
            filterValue,
            processedValue,
            isDate: processedValue instanceof Date,
            isArray: Array.isArray(processedValue)
          })
        }
        
        const filter = buildColumnFilter({
          column,
          operator,
          value: processedValue
        })
        if (filter) conditions.push(filter)
      }
    })

    // Build order by
    const orderBy = sorting.length > 0
      ? sorting.map(sort => {
          const columnMap: Record<string, any> = {
            title: todos.title,
            priority: todos.priority,
            completed: todos.completed,
            dueDate: todos.dueDate,
            createdAt: todos.createdAt,
            updatedAt: todos.updatedAt,
          }
          const column = columnMap[sort.id]
          return column ? (sort.desc ? desc(column) : asc(column)) : null
        }).filter(Boolean) as any[]
      : [desc(todos.createdAt)]

    // Get total count for pagination
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(todos)
      .where(and(...conditions))

    // Get paginated data
    const { pageIndex, pageSize } = pagination
    const offset = pageIndex * pageSize

    const todoList = await db
      .select()
      .from(todos)
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(offset)

    const response: ServerQueryResponse<typeof todoList[0]> = {
      data: todoList,
      totalCount,
      pageCount: Math.ceil(totalCount / pageSize)
    }

    return response
  })

// Get count of todos matching filters
export const getTodosTableCount = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new Error('No organization ID in context')
    }
    
    const queryData = data || {}
    const { 
      search = '', 
      filters = {},
    } = queryData

    // Build where conditions (same logic as getTodosTable)
    const conditions: any[] = [eq(todos.organizationId, orgId)]

    // Add search filter
    if (search) {
      const searchFilter = buildSearchFilter(
        [todos.title], 
        search
      )
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
          value: processedValue
        })
        if (filter) conditions.push(filter)
      }
    })

    // Get count
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(todos)
      .where(and(...conditions))

    return { totalCount }
  })

// Get all todo IDs matching filters (for select all functionality)
export const getAllTodosIds = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new Error('No organization ID in context')
    }
    
    const queryData = data || {}
    const { 
      search = '', 
      filters = {},
    } = queryData

    // Build where conditions (same logic as getTodosTable)
    const conditions: any[] = [eq(todos.organizationId, orgId)]

    // Add search filter
    if (search) {
      const searchFilter = buildSearchFilter(
        [todos.title], 
        search
      )
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
          value: processedValue
        })
        if (filter) conditions.push(filter)
      }
    })

    // Get all IDs (limit to reasonable number for safety)
    const allIds = await db
      .select({ id: todos.id })
      .from(todos)
      .where(and(...conditions))
      .limit(10000) // Safety limit

    return { ids: allIds.map(row => row.id) }
  })

// Schema for bulk delete - now simplified to just IDs
const bulkDeleteSchema = z.object({
  ids: z.array(z.string())
})

// Bulk delete todos
export const bulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new Error('No organization ID in context')
    }

    const { ids } = bulkDeleteSchema.parse(data)

    if (!ids || ids.length === 0) {
      return { success: true, deletedCount: 0 }
    }

    // Delete specific IDs, but verify they belong to the organization
    await db
      .delete(todos)
      .where(and(
        inArray(todos.id, ids),
        eq(todos.organizationId, orgId)
      ))
    
    return { success: true, deletedCount: ids.length }
  })