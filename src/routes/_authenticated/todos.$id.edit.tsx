import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, Loader2 } from 'lucide-react'

import { useErrorHandler } from '@/lib/errors/hooks'
import { getTodoById, updateTodo, deleteTodo } from '@/features/todos/lib/todos.server'
import { todoKeys } from '@/features/todos/lib/query-keys'
import { formatDateTime } from '@/lib/utils/date'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { PageHeader } from '@/components/page-header'
import { useFormAutosave } from '@/lib/hooks/use-form-autosave'
import { SaveStatusIndicator } from '@/components/save-status-indicator'
import { Input } from '@/components/taali-ui/ui/input'
import { Textarea } from '@/components/taali-ui/ui/textarea'
import { Button } from '@/components/taali-ui/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/taali-ui/ui/select'
import { Label } from '@/components/taali-ui/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/taali-ui/ui/alert-dialog'
import { usePermissions } from '@/lib/hooks/use-permissions'
import type { EditTodoFormData } from '@/types/todos'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/taali-ui/ui/breadcrumb'

export const Route = createFileRoute('/_authenticated/todos/$id/edit')({
  component: EditTodoPage,
})

function EditTodoPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { activeOrganizationId } = useActiveOrganization()
  const { canUpdateTodo, canDeleteTodo, isLoading: permissionsLoading } = usePermissions()
  const queryClient = useQueryClient()
  const [todo, setTodo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { t } = useTranslation('todos')
  const { showError, showSuccess } = useErrorHandler()
  const { t: tCommon } = useTranslation('common')

  // Load todo on mount
  useEffect(() => {
    const loadTodo = async () => {
      if (!activeOrganizationId || !id) {
        setIsLoading(false)
        return
      }

      try {
        const loadedTodo = await getTodoById({ data: { id } })
        setTodo(loadedTodo)
      } catch (error) {
        // Failed to load todo - error handled by showError
        showError(error)
        navigate({ to: '/' })
      } finally {
        setIsLoading(false)
      }
    }

    loadTodo()
  }, [id, activeOrganizationId, navigate, showError])

  // Initialize form data
  const initialData = useMemo<EditTodoFormData>(
    () => ({
      title: todo?.title || '',
      description: todo?.description || '',
      priority: todo?.priority || 'medium',
      dueDate: todo?.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '',
      assignedTo: todo?.assignedTo || '',
    }),
    [todo]
  )

  // Validation function
  const validateTodoData = useCallback(
    (data: EditTodoFormData) => {
      const errors: string[] = []
      const trimmedTitle = data.title.trim()

      if (!trimmedTitle) {
        errors.push(t('validation:validation.titleRequired'))
      } else if (trimmedTitle.length > 500) {
        errors.push(t('validation:validation.titleTooLong'))
      }

      if (data.description && data.description.length > 2000) {
        errors.push(t('validation:validation.descriptionTooLong'))
      }

      return {
        isValid: errors.length === 0,
        errors,
      }
    },
    [t]
  )

  // Custom comparison to handle whitespace
  const compareFormData = useCallback((a: EditTodoFormData, b: EditTodoFormData) => {
    return (
      a.title.trim() === b.title.trim() &&
      (a.description || '').trim() === (b.description || '').trim() &&
      a.priority === b.priority &&
      a.dueDate === b.dueDate &&
      a.assignedTo === b.assignedTo
    )
  }, [])

  // Setup auto-save
  const {
    data: formData,
    updateField,
    isSaving,
    lastSaved,
    saveNow,
    isDirty,
    errors,
  } = useFormAutosave<EditTodoFormData>({
    initialData,
    validate: validateTodoData,
    compareFunction: compareFormData,
    onSave: async data => {
      const validation = validateTodoData(data)
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '))
      }

      const trimmedTitle = data.title.trim()
      const trimmedDescription = data.description?.trim()

      const updated = await updateTodo({
        data: {
          id: id!,
          title: trimmedTitle,
          description: trimmedDescription || null,
          priority: data.priority,
          dueDate: data.dueDate || null,
          assignedTo: data.assignedTo || null,
        },
      })

      // Invalidate ALL todo queries for this organization using hierarchical structure
      if (activeOrganizationId) {
        await queryClient.invalidateQueries({
          queryKey: todoKeys.all(activeOrganizationId),
        })
      }

      // Update local todo state with the updated data
      setTodo(updated)

      // Return normalized data
      return {
        title: trimmedTitle,
        description: trimmedDescription || '',
        priority: data.priority,
        dueDate: data.dueDate,
        assignedTo: data.assignedTo,
      }
    },
    enabled: !!todo && !!activeOrganizationId,
    debounceMs: 2000, // 2 second debounce for better UX
  })

  // Handle delete
  const handleDelete = async () => {
    setDeleteDialogOpen(false) // Close dialog first to avoid DOM issues
    setIsDeleting(true)
    try {
      console.log('[TodoEdit] Deleting todo', { id, timestamp: new Date().toISOString() })
      await deleteTodo({ data: { id: id! } })

      console.log('[TodoEdit] Todo deleted, invalidating cache', {
        timestamp: new Date().toISOString(),
      })

      // Debug: Log all current cache entries before delete invalidation
      const queryCache = queryClient.getQueryCache()
      const allQueries = queryCache.getAll()
      console.log(
        '[TodoEdit] All cached queries before delete invalidation:',
        allQueries.map(q => ({
          queryKey: q.queryKey,
          state: q.state.status,
        }))
      )

      const deleteInvalidationKey = activeOrganizationId ? todoKeys.all(activeOrganizationId) : []
      console.log('[TodoEdit] Delete invalidating with hierarchical key:', deleteInvalidationKey)

      // Invalidate ALL todo queries for this organization using hierarchical structure
      if (activeOrganizationId) {
        await queryClient.invalidateQueries({
          queryKey: todoKeys.all(activeOrganizationId),
        })
      }

      showSuccess(t('common:messages.deleted'))
      navigate({ to: '/' })
    } catch (error) {
      showError(error)
      setIsDeleting(false)
    }
  }

  // Check permissions for this user
  const canEdit = canUpdateTodo()
  const canDelete = canDeleteTodo()

  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">{t('edit.noOrganization')}</h2>
        <p className="text-muted-foreground">{t('edit.noOrganizationDescription')}</p>
      </div>
    )
  }

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!todo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">{t('edit.notFound')}</h2>
        <p className="text-muted-foreground mb-4">{t('edit.notFoundDescription')}</p>
        <Button onClick={() => navigate({ to: '/' })}>{t('edit.backToTodos')}</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="hover:text-foreground transition-colors">
                    {t('title')}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{formData.title || t('edit.title')}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        actions={
          <div className="flex items-center gap-3">
            {/* Save Status */}
            <SaveStatusIndicator
              isSaving={isSaving}
              lastSaved={lastSaved}
              isDirty={isDirty}
              errors={errors}
              className="text-sm"
            />

            {/* Delete Button - Only show if user has delete permission */}
            {canDelete && (
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={isDeleting}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('edit.deleteConfirm')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('edit.deleteDescription', { title: formData.title || 'this todo' })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? tCommon('states.uploading') : tCommon('actions.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Done Button */}
            <Button
              size="sm"
              onClick={async () => {
                await saveNow()
                navigate({ to: '/' })
              }}
            >
              {t('edit.done')}
            </Button>
          </div>
        }
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {!canEdit && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{t('edit.readOnly')}</p>
            </div>
          )}
          <div className="bg-card p-6 rounded-lg shadow-md">
            <div className="space-y-6">
              {/* Title Field */}
              <div className="space-y-2">
                <Label htmlFor="title">{t('edit.titleRequired')}</Label>
                <Input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={e => updateField('title', e.target.value)}
                  onBlur={saveNow}
                  placeholder={t('edit.titlePlaceholder')}
                  disabled={!canEdit}
                  className={
                    errors.some(e => e.includes(t('validation:validation.titleRequired')))
                      ? 'border-destructive'
                      : ''
                  }
                />
                {errors.some(e => e.includes(t('validation:validation.titleRequired'))) && (
                  <p className="text-sm text-destructive">
                    {errors.find(e => e.includes(t('validation:validation.titleRequired')))}
                  </p>
                )}
              </div>

              {/* Description Field */}
              <div className="space-y-2">
                <Label htmlFor="description">{t('edit.descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  onBlur={saveNow}
                  placeholder={t('edit.descriptionPlaceholder')}
                  rows={4}
                  disabled={!canEdit}
                  className={
                    errors.some(e => e.includes(t('validation:validation.descriptionTooLong')))
                      ? 'border-destructive'
                      : ''
                  }
                />
                {errors.some(e => e.includes(t('validation:validation.descriptionTooLong'))) && (
                  <p className="text-sm text-destructive">
                    {errors.find(e => e.includes(t('validation:validation.descriptionTooLong')))}
                  </p>
                )}
              </div>

              {/* Priority and Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">{t('edit.priorityLabel')}</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: 'low' | 'medium' | 'high') => {
                      updateField('priority', value)
                      saveNow()
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue placeholder={t('edit.priorityPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('priority.low')}</SelectItem>
                      <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                      <SelectItem value="high">{t('priority.high')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">{t('edit.dueDateLabel')}</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={e => updateField('dueDate', e.target.value)}
                    onBlur={saveNow}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {/* Metadata */}
              <div className="pt-4 border-t">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{t('edit.created', { date: formatDateTime(todo.createdAt) })}</p>
                  <p>{t('edit.lastUpdated', { date: formatDateTime(todo.updatedAt) })}</p>
                  {todo.completed && (
                    <p className="text-green-600 font-medium">{t('edit.completedStatus')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
