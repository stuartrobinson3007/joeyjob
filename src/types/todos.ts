export interface Todo {
  id: string
  title: string
  description?: string | null
  organizationId: string
  createdBy: string
  assignedTo?: string | null
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateTodoInput {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  assignedTo?: string
}

export interface UpdateTodoInput {
  id: string
  title?: string
  description?: string
  completed?: boolean
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  assignedTo?: string
}