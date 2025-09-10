import { createFileRoute } from '@tanstack/react-router'
import React, { useCallback, useMemo, useState, useReducer, useEffect } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'

import { useErrorHandler } from '@/lib/errors/hooks'
import { getForm, updateForm } from '@/features/booking/lib/forms.server'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useResourceQuery } from '@/taali/hooks/use-resource-query'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'
import { FormEditorLayout } from '@/features/booking/components/form-editor/form-editor-layout'
import { 
  FormEditorDataProvider, 
  FormEditorDataAction, 
  formEditorDataReducer,
  BookingFlowData 
} from '@/features/booking/components/form-editor/context/form-editor-data-context'
import { useUnifiedAutosave } from '@/features/booking/components/form-editor/hooks/use-unified-autosave'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'

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
    queryFn: async () => {
      console.log('🔍 [FormEdit] Loading form from backend...', { formId, activeOrganizationId });
      const result = await getForm({ data: { id: formId } });
      console.log('🔍 [FormEdit] Backend response:', {
        formExists: !!result,
        formId: result?.id,
        formName: result?.name,
        formSlug: result?.slug,
        formTheme: result?.theme,
        formPrimaryColor: result?.primaryColor,
        formIsActive: result?.isActive,
        hasFormConfig: !!result?.formConfig,
        formConfigKeys: result?.formConfig ? Object.keys(result.formConfig) : [],
        serviceTreeExists: !!result?.formConfig?.serviceTree,
        serviceTreeStructure: result?.formConfig?.serviceTree ? {
          id: result.formConfig.serviceTree.id,
          type: result.formConfig.serviceTree.type,
          label: result.formConfig.serviceTree.label,
          childrenCount: result.formConfig.serviceTree.children?.length || 0
        } : null,
        baseQuestionsCount: result?.formConfig?.baseQuestions?.length || 0
      });
      return result;
    },
    enabled: !!formId && !!activeOrganizationId,
    redirectOnError: '/forms'
  })

  // Initialize form data (only when form is loaded)
  const initialData = useMemo<BookingFlowData>(() => {
    console.log('🏗️ [FormEdit] Initializing form data...', {
      formExists: !!form,
      formId,
      rawForm: form
    });

    if (!form) {
      console.log('🏗️ [FormEdit] No form data, using defaults');
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
    
    const initializedData = {
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
    };

    console.log('🏗️ [FormEdit] Initialized form data:', {
      id: initializedData.id,
      internalName: initializedData.internalName,
      slug: initializedData.slug,
      theme: initializedData.theme,
      primaryColor: initializedData.primaryColor,
      serviceTreeStructure: {
        id: initializedData.serviceTree?.id,
        type: initializedData.serviceTree?.type,
        label: initializedData.serviceTree?.label,
        childrenCount: initializedData.serviceTree?.children?.length || 0,
        hasChildren: !!initializedData.serviceTree?.children?.length
      },
      baseQuestionsCount: initializedData.baseQuestions?.length || 0,
      formConfigExists: !!form.formConfig,
      formConfigKeys: form.formConfig ? Object.keys(form.formConfig) : []
    });

    return initializedData;
  }, [form, formId])

  // Setup form data state using useReducer
  const [formData, dispatch] = useReducer(formEditorDataReducer, initialData)

  // Save function for unified autosave
  const handleSave = useCallback(async (data: BookingFlowData) => {
    console.log('💾 [FormEdit] Attempting to save form data:', {
      formId,
      dataId: data.id,
      internalName: data.internalName,
      slug: data.slug,
      theme: data.theme,
      primaryColor: data.primaryColor,
      serviceTreeSummary: {
        id: data.serviceTree?.id,
        type: data.serviceTree?.type,
        label: data.serviceTree?.label,
        childrenCount: data.serviceTree?.children?.length || 0
      },
      baseQuestionsCount: data.baseQuestions?.length || 0
    });

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
    };

    console.log('💾 [FormEdit] Server payload structure:', {
      payloadId: serverPayload.id,
      payloadName: serverPayload.name,
      payloadSlug: serverPayload.slug,
      payloadTheme: serverPayload.theme,
      payloadPrimaryColor: serverPayload.primaryColor,
      formConfigKeys: Object.keys(serverPayload.formConfig),
      formConfigServiceTree: !!serverPayload.formConfig.serviceTree,
      formConfigBaseQuestions: !!serverPayload.formConfig.baseQuestions
    });
    
    try {
      console.log('💾 [FormEdit] Calling updateForm...');
      const result = await updateForm({ data: serverPayload });
      console.log('💾 [FormEdit] updateForm success:', result);
      
      // Invalidate forms list (but not current form to prevent preview reset)
      if (activeOrganizationId) {
        console.log('💾 [FormEdit] Invalidating forms cache...');
        await queryClient.invalidateQueries({
          queryKey: ['forms', activeOrganizationId],
        });
        console.log('💾 [FormEdit] Cache invalidated');
      }
    } catch (error) {
      console.error('💾 [FormEdit] updateForm failed:', error);
      console.error('💾 [FormEdit] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        cause: error instanceof Error ? error.cause : undefined
      });
      throw error;
    }
  }, [formId, activeOrganizationId, queryClient])

  // Setup unified autosave
  const [autosaveState, autosaveActions] = useUnifiedAutosave(
    formData,
    handleSave,
    {
      debounceMs: 2000,
      maxRetries: 3,
      enableLogging: true // Always enable for debugging
    }
  );

  // Log autosave state changes
  React.useEffect(() => {
    console.log('🔄 [FormEdit] Autosave state changed:', {
      isSaving: autosaveState.isSaving,
      lastSaved: autosaveState.lastSaved?.toISOString(),
      isDirty: autosaveState.isDirty,
      errors: autosaveState.errors,
      retryCount: autosaveState.retryCount
    });
  }, [autosaveState]);

  // Log form data changes
  React.useEffect(() => {
    console.log('📝 [FormEdit] Form data changed:', {
      id: formData.id,
      internalName: formData.internalName,
      slug: formData.slug,
      serviceTreeLabel: formData.serviceTree?.label,
      serviceTreeChildren: formData.serviceTree?.children?.length || 0,
      baseQuestionsCount: formData.baseQuestions?.length || 0
    });
  }, [formData])

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
      dispatch={dispatch}
      formId={formId}
      isSaving={autosaveState.isSaving}
      lastSaved={autosaveState.lastSaved}
      isDirty={autosaveState.isDirty}
      errors={autosaveState.errors}
      saveNow={autosaveActions.saveNow}
    >
      <FormEditorLayout
        formName={form.name}
        isEnabled={optimisticIsActive !== null ? optimisticIsActive : form.isActive}
        onToggleEnabled={handleToggleEnabled}
        currentForm={form}
        isSaving={autosaveState.isSaving}
        lastSaved={autosaveState.lastSaved}
        isDirty={autosaveState.isDirty}
        saveErrors={autosaveState.errors}
        onSaveNow={autosaveActions.saveNow}
      />
    </FormEditorDataProvider>
  )
}