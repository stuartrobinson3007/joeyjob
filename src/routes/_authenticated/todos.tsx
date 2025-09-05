import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getTodos, createTodo, toggleTodo, deleteTodo } from '@/lib/todos.server'
import { useActiveOrganization } from '@/lib/organization-context'
import { useSetPageMeta } from '@/lib/page-context'
import { toast } from 'sonner'
import { Plus, Trash2, Check, Clock, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

export const Route = createFileRoute('/_authenticated/todos')({
  component: TodosPage,
})

function TodosPage() {
  const { activeOrganizationId } = useActiveOrganization()
  const [todos, setTodos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: ''
  })

  // Set page metadata
  useSetPageMeta({
    title: 'Todos',
    actions: !isCreating ? (
      <button
        onClick={() => setIsCreating(true)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        <Plus className="w-4 h-4" />
        New Todo
      </button>
    ) : null
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
    if (!newTodo.title.trim()) {
      toast.error('Please enter a title')
      return
    }

    if (!activeOrganizationId) {
      toast.error('Please select an organization')
      return
    }

    try {
      const created = await createTodo({ 
        data: {
          title: newTodo.title.trim(),
          description: newTodo.description.trim() || undefined,
          priority: newTodo.priority,
          dueDate: newTodo.dueDate || undefined
        }
      })
      
      setTodos([created, ...todos])
      setNewTodo({ title: '', description: '', priority: 'medium', dueDate: '' })
      setIsCreating(false)
      toast.success('Todo created!')
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to create todo')
    }
  }

  const handleToggle = async (id: string) => {
    if (!activeOrganizationId) {
      toast.error('Please select an organization')
      return
    }
    
    try {
      const updated = await toggleTodo({ data: { id } })
      setTodos(todos.map(t => t.id === id ? updated : t))
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to update todo')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this todo?')) return
    
    if (!activeOrganizationId) {
      toast.error('Please select an organization')
      return
    }
    
    try {
      await deleteTodo({ data: { id } })
      setTodos(todos.filter(t => t.id !== id))
      toast.success('Todo deleted')
    } catch (error: any) {
      toast.error(error.userMessage || 'Failed to delete todo')
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

      {isCreating && (
        <div className="bg-card p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Todo</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={newTodo.title}
                onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                className="w-full px-3 py-2 border-input border rounded-lg focus:ring-2 focus:ring-ring"
                placeholder="Enter todo title"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newTodo.description}
                onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                className="w-full px-3 py-2 border-input border rounded-lg focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder="Optional description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={newTodo.priority}
                  onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border-input border rounded-lg focus:ring-2 focus:ring-ring"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  value={newTodo.dueDate}
                  onChange={(e) => setNewTodo({ ...newTodo, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border-input border rounded-lg focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setIsCreating(false)
                  setNewTodo({ title: '', description: '', priority: 'medium', dueDate: '' })
                }}
                className="px-4 py-2 border rounded-lg hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTodo}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {todos.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No todos yet. Create your first one!</p>
          </div>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className={`bg-card p-4 rounded-lg shadow-sm border ${
                todo.completed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handleToggle(todo.id)}
                  className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    todo.completed 
                      ? 'bg-primary border-primary' 
                      : 'border-input hover:border-ring'
                  }`}
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
                            <Clock className="w-3 h-3" />
                            {format(new Date(todo.dueDate), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDelete(todo.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}