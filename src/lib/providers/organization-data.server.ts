import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { organization, member, account } from '@/database/schema'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import { createProviderInfoService } from './provider-registry'
import { setupOrganizationsFromOAuth } from './onboarding-setup.server'

/**
 * Get full organization data including provider information
 */
export const getOrganizationWithProviderData = createServerFn({ method: 'GET' })
  .validator((data: unknown) => 
    z.object({
      organizationId: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
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
      // Get organization data with membership check
      const orgs = await db
        .select({
          id: organization.id,
          name: organization.name,
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
          providerData: organization.providerData,
          onboardingCompleted: organization.onboardingCompleted,
          memberRole: member.role,
        })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .where(
          and(
            eq(organization.id, data.organizationId),
            eq(member.userId, userId)
          )
        )
        .limit(1)

      const org = orgs[0]
      if (!org) {
        throw new AppError(
          ERROR_CODES.BIZ_NOT_FOUND,
          404,
          { organizationId: data.organizationId, userId },
          'Organization not found or access denied'
        )
      }

      return {
        organization: org,
      }
    } catch (error) {
      console.error(`Error getting organization ${data.organizationId} for user ${userId}:`, error)
      
      if (error instanceof AppError) {
        throw error
      }
      
      throw new AppError(
        ERROR_CODES.SYS_INTERNAL_ERROR,
        500,
        { organizationId: data.organizationId, userId },
        'Failed to get organization data'
      )
    }
  })

/**
 * Get employees for an organization from its provider
 */
export const getOrganizationEmployees = createServerFn({ method: 'GET' })
  .validator((data: unknown) => 
    z.object({
      organizationId: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
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

    try {
      // Get organization first
      const { organization: org } = await getOrganizationWithProviderData({ 
        organizationId: data.organizationId 
      })

      if (!org.providerType || !org.providerCompanyId) {
        return { employees: [] } // No provider data
      }

      // Get user's OAuth tokens for this provider
      const { account } = await db
        .select({ 
          accessToken: account.accessToken,
          refreshToken: account.refreshToken
        })
        .from(account)
        .where(
          and(
            eq(account.userId, session.user.id),
            eq(account.providerId, org.providerType)
          )
        )
        .limit(1)
        .then(accounts => ({ account: accounts[0] }))

      if (!account?.accessToken || !account?.refreshToken) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { organizationId: data.organizationId, providerType: org.providerType },
          'Provider tokens not available'
        )
      }

      // Create provider service and fetch employees
      const buildConfig = {
        buildName: 'joeyjob', // This should be configurable
        domain: 'simprosuite.com',
        baseUrl: 'https://joeyjob.simprosuite.com'
      }

      const providerService = createProviderInfoService(
        org.providerType,
        account.accessToken,
        account.refreshToken,
        buildConfig,
        session.user.id
      )

      const employees = await providerService.getEmployees(org.providerCompanyId)

      return { employees }
    } catch (error) {
      console.error(`Error getting employees for organization ${data.organizationId}:`, error)
      
      if (error instanceof AppError) {
        throw error
      }
      
      return { employees: [] } // Return empty array on error rather than failing
    }
  })

/**
 * Refresh organization data from provider
 */
export const refreshOrganizationFromProvider = createServerFn({ method: 'POST' })
  .validator((data: unknown) => 
    z.object({
      organizationId: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
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

    try {
      // Re-run organization setup to pull fresh data
      const result = await setupOrganizationsFromOAuth({})
      
      return {
        success: true,
        refreshedOrganizations: result.organizations.length,
      }
    } catch (error) {
      console.error(`Error refreshing organization ${data.organizationId}:`, error)
      throw error
    }
  })