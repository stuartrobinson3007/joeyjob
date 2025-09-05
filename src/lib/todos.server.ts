import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { organizationMiddleware } from './organization-middleware'
import { checkPermission } from './permissions'
import { auth } from './auth'
import { db } from './db'
import { todos } from '@/database/schema'
import { eq, and, desc } from 'drizzle-orm'
import { AppError, PermissionError } from './errors'
import { z } from 'zod'
import { nanoid } from 'nanoid'

// Validation schemas
const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional()
})

const updateTodoSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
  completed: z.boolean().optional()
})

const todoIdSchema = z.object({
  id: z.string()
})

// Get todos for current organization
export const getTodos = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }: { context: any }) => {
    console.log('[GET_TODOS] Handler entry - context:', {
      hasUser: !!context.user,
      userId: context.user?.id,
      organizationId: context.organizationId
    })

    const orgId = context.organizationId

    const todoList = await db
      .select()
      .from(todos)
      .where(eq(todos.organizationId, orgId))
      .orderBy(desc(todos.createdAt))

    return todoList
  })

// Create a new todo
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createTodoSchema.parse(data))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    console.log('[CREATE_TODO] Handler entry - context:', {
      hasUser: !!context.user,
      userId: context.user?.id,
      organizationId: context.organizationId,
      data
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
        ...data,
        organizationId: orgId,
        createdBy: user.id,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning()

    return newTodo[0]
  })

// Update a todo
export const updateTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => updateTodoSchema.parse(data))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId

    // Check if todo exists and belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId)
      ))
      .limit(1)

    if (!existingTodo[0]) {
      throw new AppError('Todo not found', 'Todo not found', 404)
    }

    // Check permissions
    const request = getWebRequest()
    const member = await auth.api.getActiveMember({
      headers: request.headers
    })

    if (!member) {
      throw new PermissionError()
    }

    await checkPermission('todos', ['update'], orgId)

    const { id, ...updateData } = data
    const updated = await db
      .update(todos)
      .set({
        ...updateData,
        dueDate: updateData.dueDate ? new Date(updateData.dueDate) : undefined,
        updatedAt: new Date()
      })
      .where(eq(todos.id, id))
      .returning()

    return updated[0]
  })

// Delete a todo
export const deleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId

    // Check if todo exists and belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId)
      ))
      .limit(1)

    if (!existingTodo[0]) {
      throw new AppError('Todo not found', 'Todo not found', 404)
    }

    // Check permissions
    const request = getWebRequest()
    const member = await auth.api.getActiveMember({
      headers: request.headers
    })

    if (!member) {
      throw new PermissionError()
    }

    await checkPermission('todos', ['delete'], orgId)

    await db
      .delete(todos)
      .where(eq(todos.id, data.id))

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
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId)
      ))
      .limit(1)

    if (!existingTodo[0]) {
      throw new AppError('Todo not found', 'Todo not found', 404)
    }

    // Check permissions
    const request = getWebRequest()
    const member = await auth.api.getActiveMember({
      headers: request.headers
    })

    if (!member) {
      throw new PermissionError()
    }

    await checkPermission('todos', ['update'], orgId)

    const updated = await db
      .update(todos)
      .set({
        completed: !existingTodo[0].completed,
        updatedAt: new Date()
      })
      .where(eq(todos.id, data.id))
      .returning()

    return updated[0]
  })