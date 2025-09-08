import { createServerFn } from '@tanstack/react-start'
import { eq, and, isNull, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { nanoid } from 'nanoid'

import errorTranslations from '@/i18n/locales/en/errors.json'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { checkPlanLimitUtil } from '@/lib/utils/plan-limits'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'
import { ValidationError, AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import { validationRules } from '@/lib/validation/validation-registry'


// Validation schemas
const createTodoSchema = z.object({
  title: validationRules.todo.title,
  description: validationRules.todo.description,
  priority: validationRules.todo.priority.default('medium'),
  dueDate: validationRules.todo.dueDate,
  assignedTo: z.string().optional(),
})

const updateTodoSchema = z.object({
  id: z.string(),
  title: validationRules.todo.title.optional(),
  description: validationRules.todo.description.nullable().optional(),
  priority: validationRules.todo.priority.optional(),
  dueDate: validationRules.todo.dueDate.nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  completed: z.boolean().optional(),
})

// Helper to convert priority string to number
const priorityToNumber = (priority: 'low' | 'medium' | 'high' | 'urgent'): number => {
  switch (priority) {
    case 'low':
      return 1
    case 'medium':
      return 3
    case 'high':
      return 5
    case 'urgent':
      return 7
    default:
      return 3
  }
}

// Helper to convert priority number to string
const numberToPriority = (priority: number): 'low' | 'medium' | 'high' | 'urgent' => {
  if (priority <= 2) return 'low'
  if (priority <= 4) return 'medium'
  if (priority <= 6) return 'high'
  return 'urgent'
}

const todoIdSchema = z.object({
  id: z.string(),
})

// Get single todo by ID
export const getTodoById = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        'No organization context'
      )
    }

    const todo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId!), isNull(todos.deletedAt)))
      .limit(1)

    if (!todo[0]) {
      throw AppError.notFound('Todo')
    }

    // Convert priority number to string
    return {
      ...todo[0],
      priority: numberToPriority(todo[0].priority),
    }
  })

// Create a new todo
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => {
    try {
      return createTodoSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fields: Record<string, string[]> = {}
        error.issues.forEach((err: z.ZodIssue) => {
          const path = err.path.join('.')
          if (!fields[path]) fields[path] = []

          if (err.code === 'too_small' && err.minimum === 1) {
            fields[path].push('VAL_REQUIRED_FIELD')
          } else {
            fields[path].push('VAL_INVALID_FORMAT')
          }
        })
        throw new ValidationError(fields, errorTranslations.server.validationFailed)
      }
      throw error
    }
  })
  .handler(async ({ data, context }) => {

    const user = context.user
    const orgId = context.organizationId

    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        'No organization context'
      )
    }

    // Check permissions
    await checkPermission('todos', ['create'], orgId)

    // Check plan limits before creating
    const limitCheck = await checkPlanLimitUtil('todos', 'create', orgId, context.headers)

    if (!limitCheck.allowed) {
      throw new AppError(
        ERROR_CODES.BIZ_LIMIT_EXCEEDED,
        400,
        { resource: 'todos' },
        limitCheck.reason || errorTranslations.codes.BIZ_LIMIT_EXCEEDED,
        [{ action: 'upgrade' }]
      )
    }

    const newTodo = await db
      .insert(todos)
      .values({
        id: nanoid(),
        title: data.title,
        description: data.description,
        priority: priorityToNumber(data.priority),
        organizationId: orgId!,
        createdBy: user.id,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        assignedTo: data.assignedTo,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    // Convert priority back to string
    return {
      ...newTodo[0],
      priority: numberToPriority(newTodo[0].priority),
    }
  })

// Update a todo
export const updateTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => {
    try {
      return updateTodoSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fields: Record<string, string[]> = {}
        error.issues.forEach((err: z.ZodIssue) => {
          const path = err.path.join('.')
          if (!fields[path]) fields[path] = []

          if (err.code === 'too_small' && err.minimum === 1) {
            fields[path].push('VAL_REQUIRED_FIELD')
          } else {
            fields[path].push('VAL_INVALID_FORMAT')
          }
        })
        throw new ValidationError(fields, errorTranslations.server.validationFailed)
      }
      throw error
    }
  })
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId

    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        'No organization context'
      )
    }

    // Check if todo exists and belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId!), isNull(todos.deletedAt)))
      .limit(1)

    if (!existingTodo[0]) {
      throw AppError.notFound('Todo')
    }

    // Check permissions
    await checkPermission('todos', ['update'], orgId)

    const { id, priority, ...updateData } = data

    // Prepare update data
    const updatePayload: Record<string, unknown> = {
      ...updateData,
      updatedAt: new Date(),
    }

    // Convert priority if provided
    if (priority !== undefined) {
      updatePayload.priority = priorityToNumber(priority)
    }

    // Handle dueDate
    if (updateData.dueDate !== undefined) {
      updatePayload.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null
    }

    const updated = await db.update(todos).set(updatePayload).where(and(eq(todos.id, id), eq(todos.organizationId, orgId!))).returning()

    // Convert priority back to string
    return {
      ...updated[0],
      priority: numberToPriority(updated[0].priority),
    }
  })

// Delete a todo
export const deleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId

    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        'No organization context'
      )
    }

    // Check if todo exists and belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId!), isNull(todos.deletedAt)))
      .limit(1)

    if (!existingTodo[0]) {
      throw AppError.notFound('Todo')
    }


    // Check permissions
    await checkPermission('todos', ['delete'], orgId)

    // Soft delete: set deletedAt timestamp instead of hard delete
    await db
      .update(todos)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId)))

    return { success: true }
  })

// Toggle todo completion
export const toggleTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId

    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        'No organization context'
      )
    }

    // Check if todo exists and belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId!), isNull(todos.deletedAt)))
      .limit(1)

    if (!existingTodo[0]) {
      throw AppError.notFound('Todo')
    }

    // Check permissions
    await checkPermission('todos', ['update'], orgId)

    const updated = await db
      .update(todos)
      .set({
        completed: !existingTodo[0].completed,
        updatedAt: new Date(),
      })
      .where(eq(todos.id, data.id))
      .returning()

    // Convert priority back to string
    return {
      ...updated[0],
      priority: numberToPriority(updated[0].priority),
    }
  })

// Undo delete a todo (restore from soft delete)
export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId

    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        'No organization context'
      )
    }

    // Check if todo exists and is soft-deleted (belongs to organization)
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId), isNotNull(todos.deletedAt)))
      .limit(1)

    if (!existingTodo[0]) {
      throw AppError.notFound('Deleted Todo')
    }

    // Check permissions - use create permission since we're restoring
    await checkPermission('todos', ['create'], orgId)

    // Check plan limits before restoring - treat as create operation
    const limitCheck = await checkPlanLimitUtil('todos', 'create', orgId, context.headers)

    if (!limitCheck.allowed) {
      throw new AppError(
        ERROR_CODES.BIZ_LIMIT_EXCEEDED,
        400,
        { resource: 'todos' },
        limitCheck.reason || errorTranslations.codes.BIZ_LIMIT_EXCEEDED,
        [{ action: 'upgrade' }]
      )
    }

    // Restore by clearing deletedAt timestamp
    const restored = await db
      .update(todos)
      .set({
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId)))
      .returning()

    // Convert priority back to string
    return {
      ...restored[0],
      priority: numberToPriority(restored[0].priority),
    }
  })
