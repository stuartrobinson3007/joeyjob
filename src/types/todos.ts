export interface Todo {
  id: string
  title: string
  description?: string | null
  organizationId: string
  createdBy: string
  assignedTo?: string | null
  completed: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateTodoInput {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  assignedTo?: string
}

export interface UpdateTodoInput {
  id: string
  title?: string
  description?: string
  completed?: boolean
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  assignedTo?: string
}

export interface EditTodoFormData {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate: string
  assignedTo: string
  [key: string]: unknown
}
