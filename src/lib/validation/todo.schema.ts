import { z } from 'zod'

import { validationRules } from './validation-registry'

// Todo form schema
export const todoFormSchema = z.object({
  title: validationRules.todo.title,
  description: validationRules.todo.description,
  status: validationRules.todo.status,
  priority: validationRules.todo.priority,
  dueDate: validationRules.todo.dueDate
})

export type TodoFormData = z.infer<typeof todoFormSchema>

// Create todo schema
export const createTodoSchema = todoFormSchema

export type CreateTodoData = z.infer<typeof createTodoSchema>

// Update todo schema (partial updates allowed)
export const updateTodoSchema = todoFormSchema.partial().extend({
  id: z.string().uuid()
})

export type UpdateTodoData = z.infer<typeof updateTodoSchema>