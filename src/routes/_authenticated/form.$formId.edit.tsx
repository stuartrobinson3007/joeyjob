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
  FormEditorDataProvider
} from '@/features/booking/components/form-editor/context/form-editor-data-context'
import { useUnifiedAutosave } from '@/features/booking/components/form-editor/hooks/use-unified-autosave'
import {
  FormEditorState,
  FormEditorStateAction,
  FormEditorDataAction,
  BookingFlowData,
  initialFormEditorState,
  createDefaultFormData
} from '@/features/booking/components/form-editor/types/form-editor-state'
import {
  formEditorStateReducer,
  isFormEditorReady,
  getFormData
} from '@/features/booking/components/form-editor/reducers/form-editor-state-reducer'
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

  // Enhanced state management with proper loading states
  const [formEditorState, stateDispatch] = useReducer(formEditorStateReducer, initialFormEditorState);

  // Create form data from backend response
  const createFormDataFromBackend = useCallback((backendForm: any): BookingFlowData => {
    console.log('🏗️ [FormEdit] Creating form data from backend...', {
      formExists: !!backendForm,
      formId: backendForm?.id,
      formName: backendForm?.name
    });

    if (!backendForm) {
      const defaultData = createDefaultFormData(formId);
      console.log('🏗️ [FormEdit] Using default form data');
      return defaultData;
    }

    const formData = {
      id: backendForm.id,
      internalName: backendForm.name,
      slug: backendForm.slug || '',
      serviceTree: backendForm.formConfig?.serviceTree || {
        id: 'root',
        type: 'start',
        label: 'Book your service',
        children: []
      },
      baseQuestions: backendForm.formConfig?.baseQuestions || [],
      theme: (backendForm.theme as 'light' | 'dark') || 'light',
      primaryColor: backendForm.primaryColor || '#3B82F6'
    };

    console.log('🏗️ [FormEdit] Created form data from backend:', {
      id: formData.id,
      internalName: formData.internalName,
      slug: formData.slug,
      theme: formData.theme,
      primaryColor: formData.primaryColor,
      serviceTreeChildren: formData.serviceTree?.children?.length || 0,
      baseQuestionsCount: formData.baseQuestions?.length || 0
    });

    return formData;
  }, [formId]);

  // Effect to load form data when backend responds
  useEffect(() => {
    if (form && formEditorState.status === 'loading') {
      console.log('📥 [FormEdit] Backend data loaded, dispatching FORM_LOADED');
      const formData = createFormDataFromBackend(form);
      stateDispatch({ type: 'FORM_LOADED', payload: formData });
    }
  }, [form, formEditorState.status, createFormDataFromBackend]);

  // Effect to handle loading errors
  useEffect(() => {
    if (error && formEditorState.status === 'loading') {
      console.log('❌ [FormEdit] Backend load failed, dispatching FORM_LOAD_ERROR');
      const errorMessage = error instanceof Error ? error.message : 'Failed to load form';
      stateDispatch({ type: 'FORM_LOAD_ERROR', payload: errorMessage });
    }
  }, [error, formEditorState.status]);

  // Get current form data (will be null if not loaded)
  const currentFormData = getFormData(formEditorState);

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

  // Setup unified autosave (only when we have data)
  const [autosaveState, autosaveActions] = useUnifiedAutosave(
    currentFormData || createDefaultFormData(formId), // Fallback to prevent null
    handleSave,
    {
      debounceMs: 2000,
      maxRetries: 3,
      enableLogging: true // Always enable for debugging
    }
  );

  // Create dispatch wrapper that works with our enhanced state
  const dispatch = useCallback((action: FormEditorDataAction) => {
    console.log('🎯 [FormEdit] Dispatching form data action:', action.type);
    stateDispatch({ type: 'FORM_DATA_UPDATED', payload: action });
  }, []);

  // Log state changes
  useEffect(() => {
    console.log('🔄 [FormEdit] Form editor state changed:', {
      status: formEditorState.status,
      hasData: !!formEditorState.data,
      error: formEditorState.error,
      dataId: formEditorState.data?.id,
      dataName: formEditorState.data?.internalName
    });
  }, [formEditorState]);

  // Log autosave state changes
  useEffect(() => {
    console.log('🔄 [FormEdit] Autosave state changed:', {
      isSaving: autosaveState.isSaving,
      lastSaved: autosaveState.lastSaved?.toISOString(),
      isDirty: autosaveState.isDirty,
      errors: autosaveState.errors,
      retryCount: autosaveState.retryCount
    });
  }, [autosaveState]);

  // Log when current form data changes
  useEffect(() => {
    if (currentFormData) {
      console.log('📝 [FormEdit] Current form data updated:', {
        id: currentFormData.id,
        internalName: currentFormData.internalName,
        slug: currentFormData.slug,
        serviceTreeLabel: currentFormData.serviceTree?.label,
        serviceTreeChildren: currentFormData.serviceTree?.children?.length || 0,
        baseQuestionsCount: currentFormData.baseQuestions?.length || 0
      });
    }
  }, [currentFormData]);

  // Memoize mutation function to prevent recreation on every render
  const toggleActiveMutation = useMutation({
    mutationFn: useCallback(async (isActive: boolean) => {
      console.log('🔄 [FormEdit] Toggling form active state:', { formId, isActive });
      return updateForm({ 
        data: { 
          id: formId, 
          isActive 
        } 
      });
    }, [formId]),
    onMutate: useCallback(async (isActive: boolean) => {
      console.log('🔄 [FormEdit] Optimistic update:', { isActive });
      // Optimistic update
      setOptimisticIsActive(isActive);
    }, []),
    onSuccess: useCallback((data: any, isActive: boolean) => {
      console.log('🔄 [FormEdit] Toggle success:', { isActive });
      // Show success toast
      showSuccess(isActive ? 'Form enabled successfully' : 'Form disabled successfully');
      
      // Update the actual form data with server response
      if (activeOrganizationId) {
        queryClient.setQueryData(
          ['form', activeOrganizationId, formId], 
          (oldData: any) => oldData ? { ...oldData, isActive } : oldData
        );
      }
      
      // Clear optimistic state
      setOptimisticIsActive(null);
    }, [activeOrganizationId, formId, queryClient, showSuccess]),
    onError: useCallback((error: any, isActive: boolean) => {
      console.log('🔄 [FormEdit] Toggle error:', { isActive, error });
      // Revert optimistic update
      setOptimisticIsActive(null);
      
      // Show error
      showError(error);
    }, [showError])
  })

  // Handle enable toggle - memoized to prevent infinite re-renders
  const handleToggleEnabled = useCallback(() => {
    const currentActive = optimisticIsActive !== null ? optimisticIsActive : form?.isActive;
    const newActive = !currentActive;
    console.log('🔄 [FormEdit] Toggle button clicked:', { currentActive, newActive });
    toggleActiveMutation.mutate(newActive);
  }, [form?.isActive, optimisticIsActive, toggleActiveMutation.mutate])

  // Loading and error states
  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">No Organization</h2>
        <p className="text-muted-foreground">Please select an organization to continue.</p>
      </div>
    )
  }

  // Handle backend loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span className="ml-3 text-muted-foreground">Loading form...</span>
      </div>
    )
  }

  // Handle backend error state
  if (isError && error) {
    return <ErrorState error={parseError(error)} onRetry={refetch} />
  }

  // Handle form editor loading state
  if (formEditorState.status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span className="ml-3 text-muted-foreground">Preparing form editor...</span>
      </div>
    )
  }

  // Handle form editor error state
  if (formEditorState.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">Form Editor Error</h2>
        <p className="text-muted-foreground mb-4">{formEditorState.error}</p>
        <button 
          onClick={() => stateDispatch({ type: 'RESET_TO_LOADING' })} 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Reset
        </button>
      </div>
    )
  }

  // Only render form editor when we have loaded data
  if (!isFormEditorReady(formEditorState) || !currentFormData) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span className="ml-3 text-muted-foreground">Initializing editor...</span>
      </div>
    )
  }

  return (
    <FormEditorDataProvider 
      data={currentFormData}
      dispatch={dispatch}
      formId={formId}
      isSaving={autosaveState.isSaving}
      lastSaved={autosaveState.lastSaved}
      isDirty={autosaveState.isDirty}
      errors={autosaveState.errors}
      saveNow={autosaveActions.saveNow}
    >
      <FormEditorLayout
        formName={currentFormData.internalName}
        isEnabled={optimisticIsActive !== null ? optimisticIsActive : form?.isActive || false}
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