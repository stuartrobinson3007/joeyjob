import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { account, organization } from '@/database/schema'
import { createSimproApi } from './simpro-api'
import { simproProvider } from '@/lib/auth/providers/simpro.provider'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'

export interface SimproCompany {
  id: string
  name: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  phone?: string
  email?: string
  buildName?: string
  domain?: string
}

/**
 * Fetch available Simpro companies for the authenticated user
 * Uses the user's OAuth tokens from the account table
 */
export const getAvailableSimproCompanies = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    try {
      // Get user's Simpro OAuth tokens
      const accounts = await db
        .select({
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
        })
        .from(account)
        .where(
          and(
            eq(account.userId, userId),
            eq(account.providerId, 'simpro')
          )
        )
        .limit(1)

      if (!accounts.length) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { userId },
          'No Simpro account found. Please authenticate with Simpro first.'
        )
      }

      const { accessToken, refreshToken } = accounts[0]

      if (!accessToken) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { userId },
          'Simpro access token not available. Please re-authenticate with Simpro.'
        )
      }

      // TODO: Get build config from user's authentication
      // For now, use default - this should be improved to get actual build config
      const buildConfig = {
        buildName: 'joeyjob',
        domain: 'simprosuite.com'
      }

      // Try to fetch companies with current tokens, refresh if needed
      try {
        return await fetchCompaniesWithTokens(accessToken, refreshToken, buildConfig, userId)
      } catch (error) {
        // If authentication failed, try token refresh
        if (error instanceof AppError && error.code === 'AUTH_SESSION_EXPIRED' && refreshToken) {
          console.log('🔍 [CompanyConnection] OAuth token expired, attempting refresh...')

          try {
            // Refresh the tokens
            const refreshedTokens = await simproProvider.refreshToken(refreshToken, buildConfig)

            // Update database with new tokens
            await updateUserTokens(userId, refreshedTokens)

            // Retry with refreshed tokens
            return await fetchCompaniesWithTokens(
              refreshedTokens.accessToken,
              refreshedTokens.refreshToken,
              buildConfig,
              userId
            )
          } catch (refreshError) {
            console.error('🔍 [CompanyConnection] Token refresh failed:', refreshError)
            // Token refresh failed - throw auth error with update connection action
            throw new AppError(
              ERROR_CODES.AUTH_SESSION_EXPIRED,
              401,
              { provider: 'simpro' },
              'Authentication failed: Please re-authenticate with Simpro',
              [{ action: 'updateConnection', label: 'Update Connection', data: { provider: 'simpro' } }]
            )
          }
        }

        // Re-throw other errors
        throw error
      }
    } catch (error) {
      console.error('Error fetching Simpro companies:', error)
      throw error
    }
  })

/**
 * Check if a Simpro company is already connected to JoeyJob
 */
export const checkExistingOrganization = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({
    companyId: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    const { companyId } = data

    try {
      const existingOrgs = await db
        .select({
          id: organization.id,
          name: organization.name,
        })
        .from(organization)
        .where(
          and(
            eq(organization.providerType, 'simpro'),
            eq(organization.providerCompanyId, companyId)
          )
        )
        .limit(1)

      return {
        exists: existingOrgs.length > 0,
        organization: existingOrgs[0] || null
      }
    } catch (error) {
      console.error('Error checking existing organization:', error)
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        { companyId },
        'Failed to check existing organization'
      )
    }
  })

/**
 * Create organization from selected Simpro company
 * This creates the actual organization record and sets up Simpro configuration
 */
export const createOrganizationFromSimproCompany = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({
    company: z.object({
      id: z.string(),
      name: z.string(),
      buildName: z.string(),
      domain: z.string(),
      address: z.object({
        line1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
      }).optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
  }).parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.user.id
    const { company } = data

    try {
      // Get user's OAuth tokens for permanent token setup
      const accounts = await db
        .select({
          accessToken: account.accessToken,
        })
        .from(account)
        .where(
          and(
            eq(account.userId, userId),
            eq(account.providerId, 'simpro')
          )
        )
        .limit(1)

      if (!accounts.length || !accounts[0].accessToken) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { userId },
          'Simpro access token not available for organization setup'
        )
      }

      // Get build config from session storage (set during login)
      // This is more reliable than using company.buildName/domain
      const buildConfigJson = typeof window !== 'undefined'
        ? sessionStorage.getItem('simpro_build_config')
        : null

      let buildConfig
      if (buildConfigJson) {
        try {
          buildConfig = JSON.parse(buildConfigJson)
        } catch {
          // Fallback to company data if session storage is corrupted
          buildConfig = {
            buildName: company.buildName || 'joeyjob',
            domain: company.domain || 'simprosuite.com'
          }
        }
      } else {
        // Fallback to company data
        buildConfig = {
          buildName: company.buildName || 'joeyjob',
          domain: company.domain || 'simprosuite.com'
        }
      }


      // Use existing organization setup service
      const { organizationSetupService } = await import('@/lib/providers/organization-setup.service')

      const companyInfo = {
        id: company.id,
        name: company.name,
        phone: company.phone,
        email: company.email,
        address: company.address,
        providerData: {
          buildName: buildConfig.buildName,
          domain: buildConfig.domain,
        }
      }

      const organizations = await organizationSetupService.setupOrganizationsFromProvider({
        userId,
        providerType: 'simpro',
        accessToken: accounts[0].accessToken,
        refreshToken: '', // Not needed for permanent tokens
        buildConfig: {
          buildName: company.buildName,
          domain: company.domain,
          baseUrl: `https://${company.buildName}.${company.domain}`
        }
      })

      if (!organizations.organizations || organizations.organizations.length === 0) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          500,
          { companyId: company.id },
          'Failed to create organization from company data'
        )
      }

      const organizationId = organizations.organizations[0].id

      return {
        success: true,
        organizationId,
        organizationName: company.name
      }

    } catch (error) {
      console.error('Error creating organization from Simpro company:', error)

      if (error instanceof AppError) {
        throw error
      }

      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        { companyId: company.id, userId },
        'Failed to create organization. Please try again or contact support.'
      )
    }
  })

/**
 * Helper method to update user OAuth tokens in database
 */
async function updateUserTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken?: string; expiresIn?: number }
) {
  const updateData: any = {
    accessToken: tokens.accessToken,
    updatedAt: new Date(),
  }

  if (tokens.refreshToken) {
    updateData.refreshToken = tokens.refreshToken
  }

  if (tokens.expiresIn) {
    updateData.accessTokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000)
  }

  await db
    .update(account)
    .set(updateData)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, 'simpro')
      )
    )

  console.log('🔍 [CompanyConnection] Updated user OAuth tokens in database')
}

/**
 * Helper method to fetch companies with token handling
 */
async function fetchCompaniesWithTokens(
  accessToken: string,
  refreshToken: string | null,
  buildConfig: { buildName: string; domain: string },
  userId: string
): Promise<{ companies: SimproCompany[]; totalCount: number }> {
  try {
    // Create Simpro API client
    const simproApi = createSimproApi(
      accessToken,
      refreshToken || '', // Kept for compatibility but unused
      buildConfig.buildName,
      buildConfig.domain
    )

    // Fetch basic companies list from Simpro API
    const companiesResponse = await simproApi.getCompanies()
    const companies = Array.isArray(companiesResponse) ? companiesResponse : [companiesResponse]


    // Fetch detailed info for each company (including address)
    const availableCompanies: SimproCompany[] = await Promise.all(
      companies.map(async (company: any) => {

        // Get full company details including address
        const detailedCompany = await simproApi.getCompanyDetails(company.ID.toString())

        return {
          id: detailedCompany.ID.toString(),
          name: detailedCompany.Name || `Company ${detailedCompany.ID}`,
          address: detailedCompany.Address ? {
            line1: detailedCompany.Address.Line1,
            line2: detailedCompany.Address.Line2,
            city: detailedCompany.Address.City,
            state: detailedCompany.Address.State,
            postalCode: detailedCompany.Address.PostalCode,
            country: detailedCompany.Country,
          } : undefined,
          phone: detailedCompany.Phone,
          email: detailedCompany.Email,
          buildName: buildConfig.buildName,
          domain: buildConfig.domain,
        }
      })
    )


    return {
      companies: availableCompanies,
      totalCount: availableCompanies.length
    }

  } catch (error) {
    console.error('Error fetching Simpro companies:', error)

    if (error instanceof AppError) {
      throw error
    }

    // Handle specific Simpro API errors
    if (error instanceof Error && error.message.includes('401')) {
      throw new AppError(
        ERROR_CODES.AUTH_SESSION_EXPIRED,
        401,
        { userId },
        'Simpro access expired. Please re-authenticate with Simpro.',
        [{ action: 'updateConnection', label: 'Re-authenticate', data: { provider: 'simpro' } }]
      )
    }

    throw new AppError(
      ERROR_CODES.SYS_SERVER_ERROR,
      500,
      { userId },
      'Failed to fetch companies from Simpro. Please try again or contact support.'
    )
  }
}