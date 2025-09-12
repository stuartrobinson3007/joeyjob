import { useQuery } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { organization, member } from '@/database/schema'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'

/**
 * Server function to get organizations with custom fields including onboardingCompleted
 */
export const getOrganizationsWithOnboarding = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getWebRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      throw new AppError(
        ERROR_CODES.AUTH_NOT_AUTHENTICATED,
        401,
        undefined,
        'Authentication required'
      )
    }

    const userId = session.user.id

    try {
      // Get organizations with our custom fields
      const orgs = await db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
          phone: organization.phone,
          email: organization.email,
          website: organization.website,
          currency: organization.currency,
          timezone: organization.timezone,
          addressStreet: organization.addressStreet,
          addressCity: organization.addressCity,
          addressState: organization.addressState,
          addressPostalCode: organization.addressPostalCode,
          addressCountry: organization.addressCountry,
          providerType: organization.providerType,
          providerCompanyId: organization.providerCompanyId,
          onboardingCompleted: organization.onboardingCompleted,
          memberRole: member.role,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
        })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .where(eq(member.userId, userId))

      return orgs
    } catch (error) {
      console.error(`Error fetching organizations for user ${userId}:`, error)
      throw error
    }
  })

/**
 * Hook to get organizations with onboarding completion status
 * This supplements the Better Auth useListOrganizations hook with our custom fields
 */
export function useOrganizationsWithOnboarding(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['organizations-with-onboarding'],
    queryFn: () => getOrganizationsWithOnboarding(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: options?.enabled ?? true,
  })
}