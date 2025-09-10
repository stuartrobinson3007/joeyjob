import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'

import { useErrorHandler } from '@/lib/errors/hooks'
import { getForm, updateForm } from '@/features/booking/lib/forms.server'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useResourceQuery } from '@/taali/hooks/use-resource-query'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'
import { FormEditorLayout } from '@/features/booking/components/form-editor/form-editor-layout'
import { FormEditorDataProvider, FormEditorDataAction, formEditorDataReducer } from '@/features/booking/components/form-editor/context/form-editor-data-context'
import { useFormAutosave } from '@/taali/hooks/use-form-autosave'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'

// Type for the form data structure
interface BookingFlowData {
  id: string
  internalName: string
  slug: string
  serviceTree: any // FlowNode type
  baseQuestions: any[] // FormFieldConfig[]
  theme: 'light' | 'dark'
  primaryColor: string
}

export const Route = createFileRoute('/_authenticated/form/$formId/edit')({
  component: FormEditorPage,
  staticData: {
    sidebar: false, // Hide sidebar for full-screen form editor
  },
})

function FormEditorPage() {
  const { formId } = Route.useParams()
  const { activeOrganizationId } = useActiveOrganization()
  const { showError, showSuccess } = useErrorHandler()
  const queryClient = useQueryClient()

  // Optimistic state for isActive toggle
  const [optimisticIsActive, setOptimisticIsActive] = useState<boolean | null>(null)

  // Load form using resource query
  const { data: form, isLoading, isError, error, refetch } = useResourceQuery({
    queryKey: ['form', activeOrganizationId, formId],
    queryFn: () => getForm({ data: { id: formId } }),
    enabled: !!formId && !!activeOrganizationId,
    redirectOnError: '/forms'
  })

  // Initialize form data (only when form is loaded)
  const initialData = useMemo<BookingFlowData>(() => {
    if (!form) {
      return {
        id: formId,
        internalName: '',
        slug: '',
        serviceTree: {
          id: 'root',
          type: 'start',
          label: 'Book your service',
          children: []
        },
        baseQuestions: [],
        theme: 'light',
        primaryColor: '#3B82F6'
      }
    }
    
    return {
      id: form.id,
      internalName: form.name,
      slug: form.slug || '',
      serviceTree: form.formConfig?.serviceTree || {
        id: 'root',
        type: 'start',
        label: 'Book your service',
        children: []
      },
      baseQuestions: form.formConfig?.baseQuestions || [],
      theme: (form.theme as 'light' | 'dark') || 'light',
      primaryColor: form.primaryColor || '#3B82F6'
    }
  }, [form, formId])

  // Validation function
  const validateFormData = useCallback(
    (data: BookingFlowData) => {
      const errors: string[] = []
      
      if (!data.internalName?.trim()) {
        errors.push('Form name is required')
      }
      
      if (!data.serviceTree) {
        errors.push('Service tree is required')
      }

      return {
        isValid: errors.length === 0,
        errors,
      }
    },
    []
  )

  // Setup auto-save
  const {
    data: formData,
    updateData,
    isSaving,
    lastSaved,
    saveNow,
    isDirty,
    errors,
  } = useFormAutosave<BookingFlowData>({
    initialData,
    validate: validateFormData,
    onSave: async data => {
      const validation = validateFormData(data)
      if (!validation.isValid) {
        throw new AppError(
          ERROR_CODES.VAL_INVALID_FORMAT,
          400,
          { validationErrors: validation.errors },
          validation.errors.join(', ')
        )
      }

      // Transform data for server
      const serverPayload = {
        id: formId,
        name: data.internalName,
        slug: data.slug,
        formConfig: {
          id: data.id,
          internalName: data.internalName,
          serviceTree: data.serviceTree,
          baseQuestions: data.baseQuestions,
          theme: data.theme,
          primaryColor: data.primaryColor
        },
        theme: data.theme,
        primaryColor: data.primaryColor
      }
      
      try {
        const result = await updateForm({ data: serverPayload })
        
        // Invalidate forms list (but not current form to prevent preview reset)
        if (activeOrganizationId) {
          await queryClient.invalidateQueries({
            queryKey: ['forms', activeOrganizationId],
          })
        }

        // Return the data (already normalized)
        return data
      } catch (error) {
        console.error('💾 updateForm failed:', error)
        throw error
      }
    },
    enabled: !!form && !!activeOrganizationId,
    debounceMs: 2000, // 2 second debounce
  })

  // Custom dispatch function that operates on autosave data
  const customDispatch = useCallback((action: FormEditorDataAction) => {
    // Compute new state directly instead of using callback
    const newState = formEditorDataReducer(formData, action)
    
    // Update with the computed state
    updateData(newState)
  }, [updateData, formData])

  // Separate mutation for isActive toggle with optimistic updates
  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      return updateForm({ 
        data: { 
          id: formId, 
          isActive 
        } 
      })
    },
    onMutate: async (isActive) => {
      // Optimistic update
      setOptimisticIsActive(isActive)
    },
    onSuccess: (data, isActive) => {
      // Show success toast
      showSuccess(isActive ? 'Form enabled successfully' : 'Form disabled successfully')
      
      // Update the actual form data with server response
      if (activeOrganizationId) {
        queryClient.setQueryData(
          ['form', activeOrganizationId, formId], 
          (oldData: any) => oldData ? { ...oldData, isActive } : oldData
        )
      }
      
      // Clear optimistic state
      setOptimisticIsActive(null)
    },
    onError: (error, isActive) => {
      // Revert optimistic update
      setOptimisticIsActive(null)
      
      // Show error
      showError(error)
    }
  })

  // Handle enable toggle
  const handleToggleEnabled = useCallback(() => {
    const currentActive = optimisticIsActive !== null ? optimisticIsActive : form?.isActive
    const newActive = !currentActive
    toggleActiveMutation.mutate(newActive)
  }, [form?.isActive, optimisticIsActive, toggleActiveMutation])

  // Loading and error states
  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">No Organization</h2>
        <p className="text-muted-foreground">Please select an organization to continue.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    )
  }

  if (isError && error) {
    return <ErrorState error={parseError(error)} onRetry={refetch} />
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">Form Not Found</h2>
        <p className="text-muted-foreground">The form you're looking for doesn't exist.</p>
      </div>
    )
  }

  return (
    <FormEditorDataProvider 
      data={formData}
      dispatch={customDispatch}
      formId={formId}
      isSaving={isSaving}
      lastSaved={lastSaved}
      isDirty={isDirty}
      errors={errors}
      saveNow={saveNow}
    >
      <FormEditorLayout
        formName={form.name}
        isEnabled={optimisticIsActive !== null ? optimisticIsActive : form.isActive}
        onToggleEnabled={handleToggleEnabled}
        currentForm={form}
        isSaving={isSaving}
        lastSaved={lastSaved}
        isDirty={isDirty}
        saveErrors={errors}
        onSaveNow={saveNow}
      />
    </FormEditorDataProvider>
  )
}