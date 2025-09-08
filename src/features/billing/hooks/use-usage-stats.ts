import { useQuery } from '@tanstack/react-query'

import { getUsageStats } from '@/features/billing/lib/billing.server'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'

export function useUsageStats() {
  const { activeOrganizationId } = useActiveOrganization()
  
  return useQuery({
    queryKey: ['usage-stats', activeOrganizationId],
    queryFn: () => getUsageStats(),
    enabled: !!activeOrganizationId,
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 30000, // Refresh every 30 seconds for usage stats
  })
}