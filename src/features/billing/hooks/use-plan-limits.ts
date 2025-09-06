import { useMutation } from '@tanstack/react-query'
import { checkPlanLimit } from '../lib/billing.server'
import { toast } from 'sonner'

export function usePlanLimits() {
  const checkLimit = useMutation({
    mutationFn: checkPlanLimit,
    onError: (error) => {
      console.error('Failed to check plan limit:', error)
    }
  })

  const canCreate = async (resource: 'todos' | 'members' | 'storage') => {
    const result = await checkLimit.mutateAsync({ 
      resource, 
      action: 'create' 
    })
    
    if (!result.allowed && result.reason) {
      toast.error(result.reason)
    }
    
    return result.allowed
  }

  return {
    canCreate,
    checkLimit: checkLimit.mutate,
    isChecking: checkLimit.isPending,
  }
}

