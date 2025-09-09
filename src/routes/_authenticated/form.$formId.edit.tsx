import { createFileRoute } from '@tanstack/react-router'

import { useErrorHandler } from '@/lib/errors/hooks'
import { getForm } from '@/features/booking/lib/forms.server'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useResourceQuery } from '@/taali/hooks/use-resource-query'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'
import { FormEditorLayout } from '@/features/booking/components/form-editor/form-editor-layout'
import { FormEditorDataProvider } from '@/features/booking/components/form-editor/context/form-editor-data-context'

export const Route = createFileRoute('/_authenticated/form/$formId/edit')({
  component: FormEditorPage,
  staticData: {
    sidebar: false, // Hide sidebar for full-screen form editor
  },
})

function FormEditorPage() {
  const { formId } = Route.useParams()
  const { activeOrganizationId } = useActiveOrganization()
  const { showError } = useErrorHandler()

  // Load form using resource query
  const { data: form, isLoading, isError, error, refetch } = useResourceQuery({
    queryKey: ['form', activeOrganizationId, formId],
    queryFn: () => getForm({ data: { id: formId } }),
    enabled: !!formId && !!activeOrganizationId,
    redirectOnError: '/forms'
  })

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

  // Create initial form data from the loaded form
  const initialFormData = {
    id: form.id,
    internalName: form.name,
    serviceTree: form.formConfig?.serviceTree || {
      id: 'root',
      type: 'start' as const,
      label: 'Book your service',
      children: []
    },
    baseQuestions: form.formConfig?.baseQuestions || [],
    theme: (form.theme as 'light' | 'dark') || 'light',
    primaryColor: form.primaryColor || '#3B82F6'
  }

  return (
    <FormEditorDataProvider 
      initialData={initialFormData}
      formId={formId}
    >
      <FormEditorLayout
        formName={form.name}
        isEnabled={form.isActive}
        currentForm={form}
      />
    </FormEditorDataProvider>
  )
}