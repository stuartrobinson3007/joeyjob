import { useQuery } from '@tanstack/react-query'

import { getSubscription } from '@/features/billing/lib/billing.server'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'

export function useSubscription() {
  const { activeOrganizationId } = useActiveOrganization()
  
  
  const query = useQuery({
    queryKey: ['subscription', activeOrganizationId],
    queryFn: async () => {
      const result = await getSubscription()
      
      return result
    },
    enabled: !!activeOrganizationId,
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  })
  
  
  return query
}