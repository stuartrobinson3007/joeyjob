import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Trash2, Check, Clock, AlertCircle, Edit2, Loader2 } from 'lucide-react'

import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/lib/errors/codes'
import { getTodos, createTodo, toggleTodo, deleteTodo } from '@/features/todos/lib/todos.server'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useSetPageMeta } from '@/lib/hooks/page-context'
import { useLoadingItems } from '@/lib/hooks/use-loading-state'
import { LoadingOverlay } from '@/components/loading-overlay'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useLanguage } from '@/i18n/hooks/useLanguage'
import { formatDate } from '@/lib/utils/date'

export function TodosPage() {
  const { activeOrganizationId } = useActiveOrganization()
  const navigate = useNavigate()
  const [todos, setTodos] = useState<{
    id: string
    title: string
    description?: string
    completed: boolean
    priority: string
    dueDate?: string
  }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const { t } = useTranslation('todos')
  const { t: tCommon } = useTranslation('common')
  const { t: tNotifications } = useTranslation('notifications')
  const { language } = useLanguage()
  const { showError, showSuccess } = useErrorHandler()

  // Loading states for individual todo actions
  const {
    isLoading: isLoadingTodo,
    startLoading: startTodoLoading,
    stopLoading: stopTodoLoading,
  } = useLoadingItems<string>()

  // Set page metadata
  useSetPageMeta(
    {
      title: t('title'),
      actions: (
        <button
          onClick={() => handleCreateTodo()}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus />
          {isCreating ? tCommon('states.uploading') : t('new')}
        </button>
      ),
    },
    [isCreating, t, tCommon]
  )

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
        setTodos(loadedTodos.map(todo => ({
          ...todo,
          description: todo.description ?? undefined,
          priority: todo.priority as string,
          dueDate: todo.dueDate?.toISOString().split('T')[0],
        })))
      } catch (error) {
        console.error('Failed to load todos:', error)
        showError(error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTodos()
  }, [activeOrganizationId])

  const handleCreateTodo = async () => {
    if (!activeOrganizationId) {
      showError(
        new AppError(
          ERROR_CODES.VAL_REQUIRED_FIELD,
          400,
          { field: tCommon('labels.organization') },
          tNotifications('info.selectOrganization')
        )
      )
      return
    }

    setIsCreating(true)
    try {
      const created = await createTodo({
        data: {
          title: t('untitled'),
          description: '',
          priority: 'medium',
        },
      })

      showSuccess(t('common:messages.created'))
      // Navigate to edit page for the new todo
      navigate({ to: `/todos/${created.id}/edit` })
    } catch (error) {
      showError(error)
      setIsCreating(false)
    }
  }

  const handleToggle = async (id: string) => {
    if (!activeOrganizationId) {
      showError(
        new AppError(
          ERROR_CODES.VAL_REQUIRED_FIELD,
          400,
          { field: tCommon('labels.organization') },
          tNotifications('info.selectOrganization')
        )
      )
      return
    }

    startTodoLoading(id)
    try {
      const updated = await toggleTodo({ data: { id } })
      setTodos(todos.map(t => (t.id === id ? {
        ...updated,
        description: updated.description ?? undefined,
        priority: updated.priority as string,
        dueDate: updated.dueDate?.toISOString().split('T')[0],
      } : t)))
    } catch (error) {
      showError(error)
    } finally {
      stopTodoLoading(id)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('common:messages.deleteConfirm'))) return

    if (!activeOrganizationId) {
      showError(
        new AppError(
          ERROR_CODES.VAL_REQUIRED_FIELD,
          400,
          { field: tCommon('labels.organization') },
          tNotifications('info.selectOrganization')
        )
      )
      return
    }

    startTodoLoading(id)
    try {
      await deleteTodo({ data: { id } })
      setTodos(todos.filter(t => t.id !== id))
      showSuccess(t('common:messages.deleted'))
    } catch (error) {
      showError(error)
    } finally {
      stopTodoLoading(id)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-destructive bg-destructive/10'
      case 'medium':
        return 'text-warning bg-warning/10'
      case 'low':
        return 'text-success bg-success/10'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">{t('edit.noOrganization')}</h2>
        <p className="text-muted-foreground">{tNotifications('info.selectOrganization')}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="space-y-3">
        {todos.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('empty.subtitle')}</p>
          </div>
        ) : (
          todos.map(todo => {
            const isLoading = isLoadingTodo(todo.id)
            return (
              <div
                key={todo.id}
                className={`bg-card p-4 rounded-lg shadow-sm border relative ${
                  todo.completed ? 'opacity-60' : ''
                }`}
              >
                {isLoading && <LoadingOverlay variant="card" />}
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggle(todo.id)}
                    disabled={isLoading}
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                      todo.completed
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
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(todo.priority)}`}
                          >
                            {todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)}
                          </span>
                          {todo.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="min-w-3 h-3" />
                              {formatDate(new Date(todo.dueDate), 'MMM d, yyyy', language)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate({ to: `/todos/${todo.id}/edit` })}
                          disabled={isLoading}
                          className={`p-1 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={tCommon('actions.edit')}
                        >
                          <Edit2 />
                        </button>
                        <button
                          onClick={() => handleDelete(todo.id)}
                          disabled={isLoading}
                          className={`p-1 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={tCommon('actions.delete')}
                        >
                          <Trash2 />
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
