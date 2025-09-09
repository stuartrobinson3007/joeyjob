import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { getServices, createService, updateService, deleteService } from '../lib/services.server'
import { useErrorHandler } from '@/lib/errors/hooks'

// Query key factory
export const serviceKeys = {
  all: (organizationId: string) => ['services', organizationId] as const,
  detail: (organizationId: string, serviceId: string) => ['services', organizationId, serviceId] as const,
}

export function useServices() {
  const { activeOrganizationId } = useActiveOrganization()
  
  return useQuery({
    queryKey: serviceKeys.all(activeOrganizationId!),
    queryFn: () => getServices(),
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()
  const { activeOrganizationId } = useActiveOrganization()
  const { handleError, handleSuccess } = useErrorHandler()
  
  return useMutation({
    mutationFn: createService,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: serviceKeys.all(activeOrganizationId!) 
      })
      handleSuccess({ 
        message: `Service "${data.name}" created successfully` 
      })
    },
    onError: (error) => handleError(error, { context: 'Creating service' })
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()
  const { activeOrganizationId } = useActiveOrganization()
  const { handleError, handleSuccess } = useErrorHandler()
  
  return useMutation({
    mutationFn: updateService,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: serviceKeys.all(activeOrganizationId!) 
      })
      handleSuccess({ 
        message: `Service "${data.name}" updated successfully` 
      })
    },
    onError: (error) => handleError(error, { context: 'Updating service' })
  })
}

export function useDeleteService() {
  const queryClient = useQueryClient()
  const { activeOrganizationId } = useActiveOrganization()
  const { handleError, handleSuccess } = useErrorHandler()
  
  return useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: serviceKeys.all(activeOrganizationId!) 
      })
      handleSuccess({ 
        message: 'Service deleted successfully' 
      })
    },
    onError: (error) => handleError(error, { context: 'Deleting service' })
  })
}