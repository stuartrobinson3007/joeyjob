import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { nanoid } from 'nanoid'

import errorTranslations from '@/i18n/locales/en/errors.json'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'
import { ValidationError, AppError } from '@/lib/utils/errors'

// Validation schemas
const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
})

const updateTodoSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  completed: z.boolean().optional(),
})

// Helper to convert priority string to number
const priorityToNumber = (priority: 'low' | 'medium' | 'high'): number => {
  switch (priority) {
    case 'low':
      return 1
    case 'medium':
      return 3
    case 'high':
      return 5
    default:
      return 3
  }
}

// Helper to convert priority number to string
const numberToPriority = (priority: number): 'low' | 'medium' | 'high' => {
  if (priority <= 2) return 'low'
  if (priority <= 4) return 'medium'
  return 'high'
}

const todoIdSchema = z.object({
  id: z.string(),
})

// Get todos for current organization
export const getTodos = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }: { context: any }) => {
    console.log('[GET_TODOS] Handler entry - context:', {
      hasUser: !!context.user,
      userId: context.user?.id,
      organizationId: context.organizationId,
    })

    const orgId = context.organizationId

    const todoList = await db
      .select()
      .from(todos)
      .where(eq(todos.organizationId, orgId))
      .orderBy(desc(todos.createdAt))

    // Convert priority numbers to strings
    return todoList.map(todo => ({
      ...todo,
      priority: numberToPriority(todo.priority),
    }))
  })

// Get single todo by ID
export const getTodoById = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId

    const todo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId)))
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
        ;(error as any).errors.forEach((err: any) => {
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
  .handler(async ({ data, context }: { data: any; context: any }) => {
    console.log('[CREATE_TODO] Handler entry - context:', {
      hasUser: !!context.user,
      userId: context.user?.id,
      organizationId: context.organizationId,
      data,
    })

    const user = context.user
    const orgId = context.organizationId

    console.log('[CREATE_TODO] About to check permissions with orgId:', orgId)

    // Check permissions
    await checkPermission('todos', ['create'], orgId)

    const newTodo = await db
      .insert(todos)
      .values({
        id: nanoid(),
        title: data.title,
        description: data.description,
        priority: priorityToNumber(data.priority),
        organizationId: orgId,
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
        ;(error as any).errors.forEach((err: any) => {
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
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId

    // Check if todo exists and belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId)))
      .limit(1)

    if (!existingTodo[0]) {
      throw AppError.notFound('Todo')
    }

    // Check permissions
    await checkPermission('todos', ['update'], orgId)

    const { id, priority, ...updateData } = data

    // Prepare update data
    const updatePayload: any = {
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

    const updated = await db.update(todos).set(updatePayload).where(eq(todos.id, id)).returning()

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
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId
    console.log('[DELETE_TODO] Starting delete with:', {
      todoId: data.id,
      orgId,
      hasUser: !!context.user,
      userId: context.user?.id,
    })

    // Check if todo exists and belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId)))
      .limit(1)

    if (!existingTodo[0]) {
      throw AppError.notFound('Todo')
    }

    console.log('[DELETE_TODO] Todo found:', {
      todoId: existingTodo[0].id,
      todoOrgId: existingTodo[0].organizationId,
      createdBy: existingTodo[0].createdBy,
    })

    // Check permissions
    await checkPermission('todos', ['delete'], orgId)

    await db.delete(todos).where(eq(todos.id, data.id))

    return { success: true }
  })

// Toggle todo completion
export const toggleTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId

    // Check if todo exists and belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId)))
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
