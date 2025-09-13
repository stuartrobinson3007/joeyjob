import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import { db } from '@/lib/db/db'
import { account, organization } from '@/database/schema'
import { eq, and } from 'drizzle-orm'
import { employeeSyncService } from './employee-sync.service'

/**
 * Sync employees from provider and return merged list
 */
export const syncEmployeesFromProvider = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const organizationId = context.organizationId
    const userId = context.user?.id

    if (!organizationId || !userId) {
      throw new AppError(
        ERROR_CODES.AUTH_NOT_AUTHENTICATED,
        401,
        undefined,
        'Authentication required'
      )
    }

    try {
      // Get organization to determine provider type
      const orgs = await db
        .select({
          providerType: organization.providerType,
          providerCompanyId: organization.providerCompanyId,
        })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1)

      const org = orgs[0]
      if (!org?.providerType) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { organizationId },
          'Organization has no provider configuration'
        )
      }

      // Get user's OAuth tokens
      const accounts = await db
        .select({
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
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

      // Build config for provider API
      const buildConfig = {
        buildName: 'joeyjob', // TODO: Make configurable
        domain: 'simprosuite.com',
        baseUrl: 'https://joeyjob.simprosuite.com'
      }

      // Perform the actual sync using the service
      const syncedEmployees = await employeeSyncService.syncEmployeesFromProvider(
        organizationId,
        org.providerType,
        userAccount.accessToken,
        userAccount.refreshToken,
        buildConfig,
        userId
      )

      return {
        employees: syncedEmployees,
        syncedAt: new Date().toISOString(),
        organizationId,
        providerType: org.providerType
      }
    } catch (error) {
      console.error(`Error syncing employees for organization ${organizationId}:`, error)
      
      if (error instanceof AppError) {
        throw error
      }
      
      throw new AppError(
        ERROR_CODES.SYS_INTERNAL_ERROR,
        500,
        { organizationId },
        'Failed to sync employees from provider'
      )
    }
  })

/**
 * Get employees for organization (local data with sync status)
 */
export const getEmployeesForOrganization = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const organizationId = context.organizationId

    if (!organizationId) {
      throw new AppError(
        ERROR_CODES.AUTH_NOT_AUTHENTICATED,
        401,
        undefined,
        'No active organization'
      )
    }

    try {
      const employees = await employeeSyncService.getEmployeesForOrganization(organizationId)
      
      return {
        employees,
        organizationId
      }
    } catch (error) {
      console.error(`Error fetching employees for organization ${organizationId}:`, error)
      
      if (error instanceof AppError) {
        throw error
      }
      
      throw new AppError(
        ERROR_CODES.SYS_INTERNAL_ERROR,
        500,
        { organizationId },
        'Failed to fetch employees'
      )
    }
  })

/**
 * Toggle employee enabled status
 */
export const toggleEmployeeEnabled = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => 
    z.object({
      employeeId: z.string(),
      enabled: z.boolean(),
    }).parse(data || {})
  )
  .handler(async ({ data, context }) => {
    const organizationId = context.organizationId

    if (!organizationId) {
      throw new AppError(
        ERROR_CODES.AUTH_NOT_AUTHENTICATED,
        401,
        undefined,
        'No active organization'
      )
    }

    try {
      await employeeSyncService.toggleEmployeeEnabled(
        organizationId,
        data.employeeId,
        data.enabled
      )

      return {
        success: true,
        employeeId: data.employeeId,
        enabled: data.enabled,
      }
    } catch (error) {
      console.error(`Error toggling employee ${data.employeeId}:`, error)
      throw new AppError(
        ERROR_CODES.SYS_INTERNAL_ERROR,
        500,
        { employeeId: data.employeeId },
        'Failed to update employee status'
      )
    }
  })