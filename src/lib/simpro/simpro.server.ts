import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { user, account } from '@/database/schema'
import { createSimproApi } from './simpro-api'
import type { Employee, EmployeeAvailabilityRequest } from './types'

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
    .select({
      simproBuildName: user.simproBuildName,
      simproDomain: user.simproDomain,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!users.length || !users[0].simproBuildName || !users[0].simproDomain) {
    throw new Error('Missing Simpro build configuration for user')
  }

  const { simproBuildName, simproDomain } = users[0]

  return createSimproApi(accessToken, refreshToken, simproBuildName, simproDomain)
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
        Line1: bookingData.customer.address.line1,
        City: bookingData.customer.address.city,
        State: bookingData.customer.address.state,
        PostalCode: bookingData.customer.address.postalCode,
        Country: bookingData.customer.address.country,
      }
    }, true) // createSite = true

    if (!customer.Sites || customer.Sites.length === 0) {
      throw new Error('Failed to create customer site')
    }

    const siteId = customer.Sites[0].ID

    // Step 2: Create job
    const job = await simproApi.createJob({
      Type: bookingData.job.type,
      Name: bookingData.job.name,
      Description: bookingData.job.description,
      Customer: customer.ID,
      Site: siteId,
    })

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
 * Update user's Simpro tokens after refresh
 */
export async function updateUserSimproTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
) {
  try {
    await db
      .update(account)
      .set({
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(expiresAt),
      })
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'simpro')
        )
      )
  } catch (error) {
    console.error('Error updating user Simpro tokens:', error)
    throw error
  }
}