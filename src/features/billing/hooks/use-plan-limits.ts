import { useMutation } from '@tanstack/react-query'

import { checkPlanLimit } from '../lib/billing.server'

import { AppError } from '@/lib/utils/errors'

export function usePlanLimits() {
  const checkLimit = useMutation({
    mutationFn: checkPlanLimit as any,
    onError: error => {
      console.error('Failed to check plan limit:', error)
    },
  })

  const canCreate = async (resource: 'todos' | 'members' | 'storage') => {
    const result = await checkLimit.mutateAsync({
      resource,
      action: 'create',
    } as any)

    const typedResult = result as any
    if (!typedResult.allowed && typedResult.reason) {
      throw AppError.limitExceeded(resource)
    }

    return typedResult.allowed
  }

  return {
    canCreate,
    checkLimit: checkLimit.mutate,
    isChecking: checkLimit.isPending,
  }
}
