import { useMutation } from '@tanstack/react-query'

import { checkPlanLimit } from '../lib/billing.server'

import { AppError } from '@/lib/utils/errors'

interface PlanLimitResult {
  allowed: boolean
  reason?: string
  limit?: number
  usage?: number
}

export function usePlanLimits() {
  const checkLimit = useMutation({
    mutationFn: checkPlanLimit,
    // Error handling is done by the mutation consumer
  })

  const canCreate = async (resource: 'todos' | 'members' | 'storage') => {
    const result = await checkLimit.mutateAsync({
      data: {
        resource,
        action: 'create' as const,
      }
    })

    const typedResult = result as PlanLimitResult
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
