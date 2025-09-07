import { auth } from '@/lib/auth/auth'
import { checkPermission } from '@/lib/utils/permissions'

interface BillingContext {
  request?: Request
  [key: string]: any
}

/**
 * Middleware to ensure user has billing admin permissions
 * Validates session and checks organization-level billing management rights
 */
export const billingAdminMiddleware = async (context: BillingContext) => {
  console.log('[BILLING] Middleware: Received context:', {
    hasRequest: !!context.request,
    requestMethod: context.request?.method,
    contextKeys: Object.keys(context),
  })

  const request = context.request || new Request('http://localhost')
  const session = await auth.api.getSession({ headers: request.headers })

  console.log('[BILLING] Middleware: Session info:', {
    hasSession: !!session,
    hasActiveOrgId: !!session?.session?.activeOrganizationId,
    activeOrgId: session?.session?.activeOrganizationId,
  })

  if (!session?.session?.activeOrganizationId) {
    throw new Error('No active organization selected')
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
