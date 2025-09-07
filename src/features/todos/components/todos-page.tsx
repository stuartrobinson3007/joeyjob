import { useState, useEffect } from 'react'
import { getTodos, createTodo, toggleTodo, deleteTodo } from '@/features/todos/lib/todos.server'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useSetPageMeta } from '@/lib/hooks/page-context'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Plus, Trash2, Check, Clock, AlertCircle, Edit2 } from 'lucide-react'
import { format } from 'date-fns'
import { useLoadingItems } from '@/lib/hooks/use-loading-state'
import { LoadingOverlay } from '@/components/loading-overlay'

export function TodosPage() {
  const { activeOrganizationId } = useActiveOrganization()
  const navigate = useNavigate()
  const [todos, setTodos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  // Loading states for individual todo actions
  const { isLoading: isLoadingTodo, startLoading: startTodoLoading, stopLoading: stopTodoLoading } = useLoadingItems<string>()

  // Set page metadata
  useSetPageMeta({
    title: 'Todos',
    actions: (
      <button
        onClick={() => handleCreateTodo()}
        disabled={isCreating}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        {isCreating ? 'Creating...' : 'New Todo'}
      </button>
    )
  }, [isCreating])

  // Load todos when organization changes
  useEffect(() => {
    const loadTodos = async () => {
      if (!activeOrganizationId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const loadedTodos = await getTodos()
        setTodos(loadedTodos)
      } catch (error) {
        console.error('Failed to load todos:', error)
        toast.error('Failed to load todos')
      } finally {
        setIsLoading(false)
      }
    }

    loadTodos()
  }, [activeOrganizationId])

  const handleCreateTodo = async () => {
    if (!activeOrganizationId) {
      toast.error('Please select an organization')
      return
    }

    setIsCreating(true)
    try {
      const created = await createTodo({
        data: {
          title: 'Untitled Todo',
          description: '',
          priority: 'medium',
        }
      })

      toast.success('Todo created! Opening editor...')
      // Navigate to edit page for the new todo
      navigate({ to: `/todos/${created.id}/edit` })
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to create todo')
      setIsCreating(false)
    }
  }

  const handleToggle = async (id: string) => {
    if (!activeOrganizationId) {
      toast.error('Please select an organization')
      return
    }

    startTodoLoading(id)
    try {
      const updated = await toggleTodo({ data: { id } })
      setTodos(todos.map(t => t.id === id ? updated : t))
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to update todo')
    } finally {
      stopTodoLoading(id)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this todo?')) return

    if (!activeOrganizationId) {
      toast.error('Please select an organization')
      return
    }

    startTodoLoading(id)
    try {
      await deleteTodo({ data: { id } })
      setTodos(todos.filter(t => t.id !== id))
      toast.success('Todo deleted')
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to delete todo')
    } finally {
      stopTodoLoading(id)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-destructive bg-destructive/10'
      case 'medium': return 'text-warning bg-warning/10'
      case 'low': return 'text-success bg-success/10'
      default: return 'text-muted-foreground bg-muted'
    }
  }

  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">No Organization Selected</h2>
        <p className="text-muted-foreground">
          Please select an organization from the switcher above to view todos.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="space-y-3">
        {todos.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No todos yet. Create your first one!</p>
          </div>
        ) : (
          todos.map((todo) => {
            const isLoading = isLoadingTodo(todo.id)
            return (
              <div
                key={todo.id}
                className={`bg-card p-4 rounded-lg shadow-sm border relative ${todo.completed ? 'opacity-60' : ''
                  }`}
              >
                {isLoading && <LoadingOverlay variant="card" />}
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggle(todo.id)}
                    disabled={isLoading}
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${todo.completed
                      ? 'bg-primary border-primary'
                      : 'border-input hover:border-ring'
                      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {todo.completed && <Check className="w-3 h-3 text-white" />}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className={`font-medium ${todo.completed ? 'line-through' : ''}`}>
                          {todo.title}
                        </h3>
                        {todo.description && (
                          <p className="text-muted-foreground text-sm mt-1">{todo.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(todo.priority)}`}>
                            {todo.priority}
                          </span>
                          {todo.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="min-w-3 h-3" />
                              {format(new Date(todo.dueDate), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate({ to: `/todos/${todo.id}/edit` })}
                          disabled={isLoading}
                          className={`text-blue-600 hover:text-blue-700 p-1 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Edit todo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(todo.id)}
                          disabled={isLoading}
                          className={`text-red-600 hover:text-red-700 p-1 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Delete todo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}