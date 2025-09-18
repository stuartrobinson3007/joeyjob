import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { organization, member, simproCompanies } from '@/database/schema'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import { createProviderInfoService } from './provider-registry'
import { setupOrganizationsFromOAuth } from './onboarding-setup.server'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'

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
      if (!org || !org.providerType) {
        return { employees: [] } // No provider configured
      }

      let employees = []

      if (org.providerType === 'simpro') {
        // Get Simpro configuration from simpro_companies table
        const simproConfigs = await db
          .select()
          .from(simproCompanies)
          .where(eq(simproCompanies.organizationId, organizationId))
          .limit(1)

        if (!simproConfigs.length) {
          throw new AppError(
            ERROR_CODES.BIZ_INVALID_STATE,
            400,
            { organizationId, providerType: org.providerType },
            'Simpro configuration not found for organization'
          )
        }

        const { accessToken, buildName, domain, companyId } = simproConfigs[0]

        const buildConfig = {
          buildName,
          domain,
          baseUrl: `https://${buildName}.${domain}`
        }

        const providerService = createProviderInfoService(
          org.providerType,
          accessToken,
          '', // No refresh token needed
          buildConfig
        )


        // Get fresh company info
        const companyInfo = await providerService.getCompanyInfo(companyId)

        employees = await providerService.getEmployees(companyId)
      } else {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { organizationId, providerType: org.providerType },
          `Provider type ${org.providerType} not supported`
        )
      }

      return { employees }
    } catch (error) {
      
      if (error instanceof AppError) {
        throw error
      }
      
      return { employees: [] } // Return empty array on error rather than failing
    }
  })

/**
 * Refresh organization data from provider using permanent tokens
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
      // Get organization data to determine provider
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
      if (!org || !org.providerType) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { organizationId },
          'Organization has no provider configuration'
        )
      }

      if (org.providerType === 'simpro') {
        // Get Simpro configuration from simpro_companies table (permanent tokens)
        const simproConfigs = await db
          .select()
          .from(simproCompanies)
          .where(eq(simproCompanies.organizationId, organizationId))
          .limit(1)

        if (!simproConfigs.length) {
          throw new AppError(
            ERROR_CODES.BIZ_INVALID_STATE,
            400,
            { organizationId },
            'Simpro configuration not found for organization'
          )
        }

        const { accessToken, buildName, domain, companyId } = simproConfigs[0]
        const buildConfig = {
          buildName,
          domain,
          baseUrl: `https://${buildName}.${domain}`
        }

        // Create provider service with permanent token
        const providerService = createProviderInfoService(
          org.providerType,
          accessToken, // Use permanent token
          '',
          buildConfig
        )

        // Fetch fresh company data from Simpro
        const companyInfo = await providerService.getCompanyInfo(companyId)

        // Update organization with fresh data
        await db
          .update(organization)
          .set({
            name: companyInfo.name,
            phone: companyInfo.phone,
            email: companyInfo.email,
            website: companyInfo.website,
            timezone: companyInfo.timezone || organization.timezone, // Keep existing if not provided
            currency: companyInfo.currency,
            addressLine1: companyInfo.address?.line1,
            addressLine2: companyInfo.address?.line2,
            addressCity: companyInfo.address?.city,
            addressState: companyInfo.address?.state,
            addressPostalCode: companyInfo.address?.postalCode,
            addressCountry: companyInfo.address?.country,
            updatedAt: new Date(),
          })
          .where(eq(organization.id, organizationId))

        return {
          success: true,
          updatedAt: new Date().toISOString(),
          organizationId
        }
      } else {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { organizationId, providerType: org.providerType },
          `Provider type ${org.providerType} not supported`
        )
      }
    } catch (error) {
      console.error(`Error refreshing organization ${organizationId} from provider:`, error)
      
      if (error instanceof AppError) {
        throw error
      }
      
      throw new AppError(
        ERROR_CODES.SYS_INTERNAL_ERROR,
        500,
        { organizationId },
        'Failed to refresh organization data from provider'
      )
    }
  })