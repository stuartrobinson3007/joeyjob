import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { user, account, organization, member } from '@/database/schema'
import { createSimproApi } from './simpro-api'
import type { Employee, EmployeeAvailabilityRequest } from './types'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'

/**
 * Get Simpro API instance for a user
 */
export async function getSimproApiForUser(userId: string) {
  // Get user's Simpro OAuth account
  const accounts = await db
    .select({
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      expiresAt: account.accessTokenExpiresAt,
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
    throw new Error('No Simpro account found for user')
  }

  const { accessToken, refreshToken } = accounts[0]
  
  if (!accessToken || !refreshToken) {
    throw new Error('Missing Simpro tokens for user')
  }

  // Get user's Simpro build configuration
  const users = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!users.length || !users[0].simproBuildName || !users[0].simproDomain) {
    console.error('Missing Simpro build configuration for user:', userId, {
      userFound: users.length > 0,
      simproBuildName: users[0]?.simproBuildName,
      simproDomain: users[0]?.simproDomain
    })
    throw new Error('Missing Simpro build configuration for user')
  }

  const { simproBuildName, simproDomain } = users[0]

  // Create standardized token refresh callback
  const tokenRefreshCallback = createTokenRefreshCallback(userId, 'GET_SIMPRO_API')

  return createSimproApi(
    accessToken, 
    refreshToken, 
    simproBuildName, 
    simproDomain,
    userId,
    tokenRefreshCallback
  )
}

/**
 * Get Simpro API instance for an organization (preferred approach)
 */
export async function getSimproApiForOrganization(organizationId: string, userId: string) {
  // Get user's Simpro OAuth tokens
  const accounts = await db
    .select({
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      expiresAt: account.accessTokenExpiresAt,
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
    throw new Error('No Simpro account found for user')
  }

  const { accessToken, refreshToken } = accounts[0]
  
  if (!accessToken || !refreshToken) {
    throw new Error('Missing Simpro tokens for user')
  }

  // Get organization's Simpro configuration
  const orgs = await db
    .select()
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1)

  if (!orgs.length) {
    throw new Error('Organization not found')
  }

  const org = orgs[0]
  if (!org.providerType || org.providerType !== 'simpro') {
    throw new Error('Organization is not configured for Simpro')
  }

  // Extract Simpro configuration from provider data
  const providerData = org.providerData as any
  if (!providerData?.buildName || !providerData?.domain) {
    console.error('Missing Simpro configuration in organization:', organizationId, {
      providerType: org.providerType,
      providerCompanyId: org.providerCompanyId,
      hasProviderData: !!org.providerData,
      providerData: org.providerData
    })
    throw new Error('Missing Simpro build configuration for organization')
  }

  const { buildName: simproBuildName, domain: simproDomain } = providerData

  // Create standardized token refresh callback
  const tokenRefreshCallback = createTokenRefreshCallback(userId, 'GET_SIMPRO_API')

  return createSimproApi(
    accessToken, 
    refreshToken, 
    simproBuildName, 
    simproDomain,
    userId,
    tokenRefreshCallback
  )
}

/**
 * Get list of employees for a user from Simpro
 */
export async function getEmployeesForUser(userId: string): Promise<Employee[]> {
  try {
    const simproApi = await getSimproApiForUser(userId)
    return await simproApi.getEmployees()
  } catch (error) {
    console.error('Error fetching employees for user:', error)
    throw error
  }
}

/**
 * Get employee availability for a user
 */
export async function getEmployeeAvailabilityForUser(
  userId: string, 
  request: EmployeeAvailabilityRequest
): Promise<any[]> {
  try {
    const simproApi = await getSimproApiForUser(userId)
    return await simproApi.getEmployeeAvailability(request)
  } catch (error) {
    console.error('Error fetching employee availability for user:', error)
    throw error
  }
}

/**
 * Test Simpro connection for a user
 */
export async function testSimproConnectionForUser(userId: string): Promise<boolean> {
  try {
    const simproApi = await getSimproApiForUser(userId)
    await simproApi.testConnection()
    return true
  } catch (error) {
    console.error('Error testing Simpro connection for user:', error)
    return false
  }
}

/**
 * Create a booking in Simpro for a user
 */
export async function createSimproBookingForUser(
  userId: string,
  bookingData: {
    customer: {
      givenName: string
      familyName: string
      email: string
      phone: string
      address: {
        line1: string
        city: string
        state: string
        postalCode: string
        country: string
      }
    }
    job: {
      type: 'Service' | 'Project' | 'Prepaid'
      name: string
      description: string
    }
    schedule: {
      employeeId: number
      blocks: Array<{
        startTime: string
        endTime: string
        date: string
      }>
    }
  }
) {
  try {
    const simproApi = await getSimproApiForUser(userId)

    // Step 1: Create customer with site
    const customer = await simproApi.createCustomer({
      GivenName: bookingData.customer.givenName,
      FamilyName: bookingData.customer.familyName,
      Email: bookingData.customer.email,
      Phone: bookingData.customer.phone,
      Address: {
        Address: bookingData.customer.address.line1,
        City: bookingData.customer.address.city,
        State: bookingData.customer.address.state,
        PostalCode: bookingData.customer.address.postalCode,
        Country: bookingData.customer.address.country,
      }
    }, true) // createSite = true

    if (!customer.Sites || customer.Sites.length === 0) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        { customerId: customer.ID },
        'Failed to create customer site in scheduling system'
      )
    }

    const siteId = customer.Sites[0].ID

    // Step 2: Create job
    const jobData = {
      Type: bookingData.job.type,
      Name: bookingData.job.name,
      Description: bookingData.job.description,
      Customer: customer.ID,
      Site: siteId,
    } as any
    
    // Add Notes field if provided
    if (bookingData.job.notes) {
      jobData.Notes = bookingData.job.notes
    }
    
    const job = await simproApi.createJob(jobData)

    // Step 3: Schedule job
    const schedule = await simproApi.scheduleJob(job.ID, {
      Staff: bookingData.schedule.employeeId,
      Blocks: bookingData.schedule.blocks.map(block => ({
        StartTime: block.startTime,
        EndTime: block.endTime,
        Date: block.date,
      })),
    })

    return {
      customer,
      job,
      schedule,
    }
  } catch (error) {
    console.error('Error creating Simpro booking for user:', error)
    throw error
  }
}

/**
 * Create a standardized token refresh callback for Simpro API instances
 * This ensures consistent token persistence across all API calls
 */
export function createTokenRefreshCallback(userId: string, requestId?: string) {
  const logPrefix = requestId ? `[${requestId}]` : '[TOKEN_REFRESH]'
  
  return async (
    accessToken: string,
    refreshToken: string,
    accessTokenExpiresAt: number,
    refreshTokenExpiresAt: number
  ) => {
    console.log(`${logPrefix} Token refresh callback triggered for user ${userId}`)
    
    // Validate parameters before database update
    if (!accessToken || !refreshToken) {
      console.error(`${logPrefix} ❌ Invalid tokens provided to refresh callback`, {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        userId
      })
      throw new AppError(
        ERROR_CODES.SYS_TOKEN_INVALID,
        500,
        { userId, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, provider: 'simpro' },
        'Invalid tokens provided to refresh callback',
        [{ action: 'updateConnection', label: 'Update Connection', data: { provider: 'simpro' } }]
      )
    }
    
    if (!accessTokenExpiresAt || !refreshTokenExpiresAt) {
      console.error(`${logPrefix} ❌ Invalid expiration times provided to refresh callback`, {
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        userId
      })
      throw new AppError(
        ERROR_CODES.SYS_TOKEN_INVALID,
        500,
        { userId, accessTokenExpiresAt, refreshTokenExpiresAt, provider: 'simpro' },
        'Invalid token expiration times provided to refresh callback',
        [{ action: 'updateConnection', label: 'Update Connection', data: { provider: 'simpro' } }]
      )
    }
    
    try {
      console.log(`${logPrefix} 💾 Persisting new tokens to database for user ${userId}`)
      await updateUserSimproTokens(
        userId,
        accessToken,
        refreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt
      )
      console.log(`${logPrefix} ✅ Tokens successfully persisted to database`)
    } catch (error) {
      console.error(`${logPrefix} ❌ Failed to persist tokens to database:`, error)
      throw new AppError(
        ERROR_CODES.SYS_TOKEN_PERSISTENCE_FAILED,
        500,
        { userId, originalError: error instanceof Error ? error.message : String(error), provider: 'simpro' },
        'Failed to persist refreshed tokens to database',
        [{ action: 'updateConnection', label: 'Update Connection', data: { provider: 'simpro' } }]
      )
    }
  }
}

/**
 * Update user's Simpro tokens after refresh
 */
export async function updateUserSimproTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  accessTokenExpiresAt: number,
  refreshTokenExpiresAt: number
) {
  try {
    const result = await db
      .update(account)
      .set({
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(accessTokenExpiresAt),
        refreshTokenExpiresAt: new Date(refreshTokenExpiresAt),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'simpro')
        )
      )
    return result
  } catch (error) {
    console.error('❌ Error updating user Simpro tokens:', error)
    throw error
  }
}