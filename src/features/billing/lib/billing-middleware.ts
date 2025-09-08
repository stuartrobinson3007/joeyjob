import { auth } from '@/lib/auth/auth'
import { checkPermission } from '@/lib/utils/permissions'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'

interface BillingContext {
  request?: Request
  [key: string]: unknown
}

/**
 * Middleware to ensure user has billing admin permissions
 * Validates session and checks organization-level billing management rights
 */
export const billingAdminMiddleware = async (context: BillingContext) => {

  const request = context.request || new Request('http://localhost')
  const session = await auth.api.getSession({ headers: request.headers })


  if (!session?.session?.activeOrganizationId) {
    throw new AppError(
      ERROR_CODES.VAL_REQUIRED_FIELD,
      400,
      { field: 'activeOrganizationId' },
      'No active organization selected'
    )
  }

  const { activeOrganizationId: organizationId } = session.session

  // Verify billing management permissions
  await checkPermission(
    'billing',
    ['manage'],
    organizationId,
    'Billing management permission required'
  )

  return {
    ...context,
    user: session.user,
    session: session.session,
    organizationId,
    headers: request.headers,
  }
}
