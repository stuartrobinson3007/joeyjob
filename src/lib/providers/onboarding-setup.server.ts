import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { account, organization } from '@/database/schema'
import { organizationSetupService } from './organization-setup.service'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'

/**
 * Set up organizations for a user based on their OAuth provider account
 * This is called during the onboarding process after successful OAuth login
 */
export const setupOrganizationsFromOAuth = createServerFn({ method: 'POST' })
  .validator((data: unknown) => 
    z.object({
      providerId: z.string().optional(), // If not provided, will try to detect
      buildConfig: z.object({
        buildName: z.string(),
        domain: z.string(),
        baseUrl: z.string(),
      }).optional(), // Build configuration for providers that need it
    }).parse(data || {}) // Handle null/undefined data
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
      // Get user's OAuth account(s) 
      let providerId = data.providerId
      let userAccount

      if (providerId) {
        // Look for specific provider
        const accounts = await db
          .select()
          .from(account)
          .where(
            and(
              eq(account.userId, userId),
              eq(account.providerId, providerId)
            )
          )
          .limit(1)

        userAccount = accounts[0]
      } else {
        // Find any OAuth account (should be Simpro for now)
        const accounts = await db
          .select()
          .from(account)
          .where(eq(account.userId, userId))
          .limit(1)

        userAccount = accounts[0]
        if (userAccount) {
          providerId = userAccount.providerId
        }
      }

      if (!userAccount) {
        throw new AppError(
          ERROR_CODES.BIZ_NOT_FOUND,
          404,
          { userId, providerId },
          'No OAuth account found for user'
        )
      }

      if (!userAccount.accessToken || !userAccount.refreshToken) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { userId, providerId },
          'OAuth tokens not available'
        )
      }

      // Use provided build config or determine based on provider
      let buildConfig = data.buildConfig
      if (!buildConfig) {
        // Fall back to default config if none provided (for backward compatibility)
        if (providerId === 'simpro') {
          buildConfig = {
            buildName: 'joeyjob',
            domain: 'simprosuite.com',
            baseUrl: 'https://joeyjob.simprosuite.com'
          }
        } else {
          throw new AppError(
            ERROR_CODES.BIZ_UNSUPPORTED_OPERATION,
            400,
            { providerId },
            `Unsupported provider: ${providerId}`
          )
        }
      }

      // Create token refresh callback to update database
      const onTokenRefresh = async (
        accessToken: string,
        refreshToken: string,
        accessTokenExpiresAt: number,
        refreshTokenExpiresAt: number
      ) => {
        await db
          .update(account)
          .set({
            accessToken,
            refreshToken,
            accessTokenExpiresAt: new Date(accessTokenExpiresAt),
            refreshTokenExpiresAt: new Date(refreshTokenExpiresAt),
            updatedAt: new Date(),
          })
          .where(eq(account.id, userAccount.id))
      }

      // Set up organizations using the organization setup service
      const result = await organizationSetupService.setupOrganizationsFromProvider({
        userId,
        providerType: providerId,
        accessToken: userAccount.accessToken,
        refreshToken: userAccount.refreshToken,
        buildConfig,
        onTokenRefresh,
      })

      return {
        success: true,
        organizations: result.organizations,
        defaultOrganizationId: result.defaultOrganizationId,
        providerType: providerId,
      }
    } catch (error) {
      console.error(`Error setting up organizations for user ${userId}:`, error)
      
      if (error instanceof AppError) {
        throw error
      }
      
      throw new AppError(
        ERROR_CODES.SYS_INTERNAL_ERROR,
        500,
        { userId, providerId },
        'Failed to set up organizations from provider'
      )
    }
  })

/**
 * Get organizations for the user
 * All organizations are ready to use immediately after creation
 */
export const getPendingOnboardingOrganizations = createServerFn({ method: 'GET' })
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
      const orgs = await organizationSetupService.getOrganizationsByProvider(
        userId,
        'simpro' // For now, only checking Simpro organizations
      )

      return {
        organizations: orgs, // All organizations are ready to use
        hasProviderConnection: orgs.length > 0,
      }
    } catch (error) {
      console.error(`Error getting pending onboarding organizations for user ${userId}:`, error)
      throw new AppError(
        ERROR_CODES.SYS_INTERNAL_ERROR,
        500,
        { userId },
        'Failed to get pending organizations'
      )
    }
  })

// Organization onboarding completion removed - organizations are ready to use immediately after creation