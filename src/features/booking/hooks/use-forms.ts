import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { getForm, updateForm, deleteForm, createForm } from '../lib/forms.server'
import { useErrorHandler } from '@/lib/errors/hooks'

// Query key factory
export const formKeys = {
  all: (organizationId: string) => ['forms', organizationId] as const,
  detail: (organizationId: string, formId: string) => ['forms', organizationId, formId] as const,
}

export function useForm(formId: string) {
  const { activeOrganizationId } = useActiveOrganization()
  
  return useQuery({
    queryKey: formKeys.detail(activeOrganizationId!, formId),
    queryFn: () => getForm({ data: { id: formId } }),
    enabled: !!activeOrganizationId && !!formId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpdateForm() {
  const queryClient = useQueryClient()
  const { activeOrganizationId } = useActiveOrganization()
  const { handleError, handleSuccess } = useErrorHandler()
  
  return useMutation({
    mutationFn: updateForm,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: formKeys.all(activeOrganizationId!) 
      })
      queryClient.invalidateQueries({ 
        queryKey: formKeys.detail(activeOrganizationId!, data.id) 
      })
      // Don't show success toast for auto-save operations
    },
    onError: (error) => handleError(error, { context: 'Updating form' })
  })
}

export function useCreateForm() {
  const queryClient = useQueryClient()
  const { activeOrganizationId } = useActiveOrganization()
  const { handleError, handleSuccess } = useErrorHandler()
  
  return useMutation({
    mutationFn: createForm,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: formKeys.all(activeOrganizationId!) 
      })
      handleSuccess({ 
        message: `Form "${data.name}" created successfully` 
      })
    },
    onError: (error) => handleError(error, { context: 'Creating form' })
  })
}

export function useDeleteForm() {
  const queryClient = useQueryClient()
  const { activeOrganizationId } = useActiveOrganization()
  const { handleError, handleSuccess } = useErrorHandler()
  
  return useMutation({
    mutationFn: deleteForm,
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: formKeys.all(activeOrganizationId!) 
      })
      handleSuccess({ 
        message: 'Form deleted successfully' 
      })
    },
    onError: (error) => handleError(error, { context: 'Deleting form' })
  })
}