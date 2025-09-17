import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { simproCompanies } from '@/database/schema'
import { createSimproApi } from './simpro-api'
import type { Employee, EmployeeAvailabilityRequest } from './types'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'


/**
 * Get Simpro API instance for an organization
 * Now uses organization-level tokens from simpro_companies table
 */
export async function getSimproApiForOrganization(organizationId: string) {
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
      { organizationId },
      'No Simpro configuration found for organization'
    )
  }

  const { accessToken, buildName, domain } = simproConfigs[0]

  // Create Simpro API instance with permanent token (no refresh needed)
  return createSimproApi(
    accessToken,
    '', // No refresh token needed
    buildName,
    domain
  )
}

/**
 * Get list of employees for an organization from Simpro
 */
export async function getEmployeesForOrganization(organizationId: string): Promise<Employee[]> {
  try {
    const simproApi = await getSimproApiForOrganization(organizationId)
    return await simproApi.getEmployees()
  } catch (error) {
    console.error('Error fetching employees for organization:', error)
    throw error
  }
}

/**
 * Get employee availability for an organization
 */
export async function getEmployeeAvailabilityForOrganization(
  organizationId: string,
  request: EmployeeAvailabilityRequest
): Promise<any[]> {
  try {
    const simproApi = await getSimproApiForOrganization(organizationId)
    return await simproApi.getEmployeeAvailability(request)
  } catch (error) {
    console.error('Error fetching employee availability for organization:', error)
    throw error
  }
}

/**
 * Test Simpro connection for an organization
 */
export async function testSimproConnectionForOrganization(organizationId: string): Promise<boolean> {
  try {
    const simproApi = await getSimproApiForOrganization(organizationId)
    await simproApi.testConnection()
    return true
  } catch (error) {
    console.error('Error testing Simpro connection for organization:', error)
    return false
  }
}

/**
 * Create a booking in Simpro for an organization
 */
export async function createSimproBookingForOrganization(
  organizationId: string,
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
      notes?: string
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
    const simproApi = await getSimproApiForOrganization(organizationId)

    // Step 1: Check for existing customer by email
    let customer = await simproApi.findCustomerByEmail(bookingData.customer.email)
    let siteId: number

    if (customer) {
      console.log(`Found existing customer ID ${customer.ID} for email: ${bookingData.customer.email}`)
      
      // Step 2a: Find or create site for existing customer
      siteId = await simproApi.findOrCreateSiteForCustomer(
        customer.ID,
        {
          line1: bookingData.customer.address.line1,
          city: bookingData.customer.address.city,
          state: bookingData.customer.address.state,
          postalCode: bookingData.customer.address.postalCode,
          country: bookingData.customer.address.country
        }
      )
      console.log(`Using site ID ${siteId} for customer ${customer.ID}`)
    } else {
      // Step 2b: Create new customer with site
      console.log(`Creating new customer for email: ${bookingData.customer.email}`)
      customer = await simproApi.createCustomer({
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

      siteId = customer.Sites[0].ID
      console.log(`Created new customer ID ${customer.ID} with site ID ${siteId}`)
    }

    // Step 3: Create job
    
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
    

    // Step 4: Schedule job
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

// Token refresh functions removed - no longer needed with permanent tokens