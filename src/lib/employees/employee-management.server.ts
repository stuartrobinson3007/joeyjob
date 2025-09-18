import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import { db } from '@/lib/db/db'
import { eq } from 'drizzle-orm'
import { employeeSyncService } from './employee-sync.service'

// Import tables separately to avoid potential issues
import * as schema from '@/database/schema'
const { organization, simproCompanies } = schema

/**
 * Sync employees from provider and return merged list
 */
export const syncEmployeesFromProvider = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const organizationId = context.organizationId
    const userId = context.user?.id

    console.log('🔍 [syncEmployeesFromProvider] Starting sync with:', {
      organizationId,
      userId,
      hasContext: !!context
    })

    if (!organizationId || !userId) {
      console.error('🔍 [syncEmployeesFromProvider] Missing required IDs:', { organizationId, userId })
      throw new AppError(
        ERROR_CODES.AUTH_NOT_AUTHENTICATED,
        401,
        undefined,
        'Authentication required'
      )
    }

    try {
      // Get organization to determine provider type
      console.log('🔍 [syncEmployeesFromProvider] About to query organization table...')
      
      const orgs = await db
        .select({
          providerType: organization.providerType,
        })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1)

      const org = orgs[0]
      console.log('🔍 [syncEmployeesFromProvider] Organization data:', {
        hasOrg: !!org,
        providerType: org?.providerType
      })

      if (!org?.providerType) {
        console.error('🔍 [syncEmployeesFromProvider] No provider type found for org:', organizationId)
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { organizationId },
          'Organization has no provider configuration'
        )
      }

      // Get Simpro configuration from simpro_companies table
      console.log('🔍 [syncEmployeesFromProvider] Fetching Simpro config for org:', organizationId)
      const simproConfigs = await db
        .select()
        .from(simproCompanies)
        .where(eq(simproCompanies.organizationId, organizationId))
        .limit(1)

      console.log('🔍 [syncEmployeesFromProvider] Simpro config result:', {
        found: simproConfigs.length > 0,
        buildName: simproConfigs[0]?.buildName,
        domain: simproConfigs[0]?.domain,
        hasAccessToken: !!simproConfigs[0]?.accessToken
      })

      if (!simproConfigs.length) {
        console.error('🔍 [syncEmployeesFromProvider] No Simpro config found')
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { organizationId, providerType: org.providerType },
          'Simpro configuration not found for organization'
        )
      }

      const { accessToken, buildName, domain } = simproConfigs[0]

      const buildConfig = {
        buildName,
        domain,
        baseUrl: `https://${buildName}.${domain}`
      }

      // Perform the actual sync using the service
      console.log('🔍 [syncEmployeesFromProvider] Calling sync service with buildConfig:', buildConfig)
      const syncedEmployees = await employeeSyncService.syncEmployeesFromProvider(
        organizationId,
        org.providerType,
        accessToken,
        '', // No refresh token needed
        buildConfig,
        userId // Pass the userId for created_by field
      )

      console.log('🔍 [syncEmployeesFromProvider] Sync completed:', {
        employeeCount: syncedEmployees.length,
        organizationId,
        providerType: org.providerType
      })

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

    console.log('🔍 [getEmployeesForOrganization] Fetching employees for org:', {
      organizationId,
      hasContext: !!context,
      userId: context.user?.id
    })

    if (!organizationId) {
      console.error('🔍 [getEmployeesForOrganization] No organizationId in context')
      throw new AppError(
        ERROR_CODES.AUTH_NOT_AUTHENTICATED,
        401,
        undefined,
        'No active organization'
      )
    }

    try {
      const employees = await employeeSyncService.getEmployeesForOrganization(organizationId)
      
      console.log('🔍 [getEmployeesForOrganization] Found employees:', {
        count: employees.length,
        organizationId,
        sampleEmployee: employees[0] || null
      })
      
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