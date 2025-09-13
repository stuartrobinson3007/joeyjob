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
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { createTokenRefreshCallback } from '@/lib/simpro/simpro.server'

/**
 * Get full organization data including provider information
 */
export const getOrganizationWithProviderData = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    
    const organizationId = context.organizationId
    const userId = context.user?.id

    if (!organizationId) {
      throw new AppError(
        ERROR_CODES.BIZ_NOT_FOUND,
        404,
        { userId },
        'No active organization selected'
      )
    }

    if (!userId) {
      throw new AppError(
        ERROR_CODES.AUTH_NOT_AUTHENTICATED,
        401,
        undefined,
        'Authentication required'
      )
    }

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
          addressLine1: organization.addressLine1,
          addressLine2: organization.addressLine2,
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
            eq(organization.id, organizationId),
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
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    
    const organizationId = context.organizationId
    const userId = context.user?.id

    if (!organizationId) {
      throw new AppError(
        ERROR_CODES.BIZ_NOT_FOUND,
        404,
        { userId },
        'No active organization selected'
      )
    }

    if (!userId) {
      throw new AppError(
        ERROR_CODES.AUTH_NOT_AUTHENTICATED,
        401,
        undefined,
        'Authentication required'
      )
    }

    try {
      
      // Get organization data first
      const orgs = await db
        .select({
          providerType: organization.providerType,
          providerCompanyId: organization.providerCompanyId,
        })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .where(
          and(
            eq(organization.id, organizationId),
            eq(member.userId, userId)
          )
        )
        .limit(1)

      const org = orgs[0]
      if (!org || !org.providerType || !org.providerCompanyId) {
        return { employees: [] } // No provider data
      }

      // Get user's OAuth tokens for this provider
      const accounts = await db
        .select({ 
          accessToken: account.accessToken,
          refreshToken: account.refreshToken
        })
        .from(account)
        .where(
          and(
            eq(account.userId, userId),
            eq(account.providerId, org.providerType)
          )
        )
        .limit(1)

      const userAccount = accounts[0]

      if (!userAccount?.accessToken || !userAccount?.refreshToken) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { organizationId, providerType: org.providerType },
          'Provider tokens not available'
        )
      }

      // Create provider service and fetch employees
      const buildConfig = {
        buildName: 'joeyjob', // This should be configurable
        domain: 'simprosuite.com',
        baseUrl: 'https://joeyjob.simprosuite.com'
      }

      // Create token refresh callback to persist tokens after refresh
      const tokenRefreshCallback = createTokenRefreshCallback(userId, 'GET_ORG_EMPLOYEES')

      const providerService = createProviderInfoService(
        org.providerType,
        userAccount.accessToken,
        userAccount.refreshToken,
        buildConfig,
        userId,
        tokenRefreshCallback
      )

      const employees = await providerService.getEmployees(org.providerCompanyId)

      return { employees }
    } catch (error) {
      
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
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const organizationId = context.organizationId
    const userId = context.user?.id

    if (!organizationId) {
      throw new AppError(
        ERROR_CODES.BIZ_NOT_FOUND,
        404,
        { userId },
        'No active organization selected'
      )
    }

    if (!userId) {
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
      throw error
    }
  })