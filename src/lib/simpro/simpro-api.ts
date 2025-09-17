import type { 
  TokenResponse, 
  ApiResponse, 
  TokenErrorResponse,
  Customer,
  Job,
  Schedule,
  Employee,
  EmployeeAvailabilityRequest,
  CreateCustomerRequest,
  CreateJobRequest,
  ScheduleJobRequest,
  SimproConfig
} from './types'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'

/**
 * Simpro API client for interacting with Simpro services
 * Handles authentication, token refresh, and API calls
 */
export class SimproApi {
  private accessToken: string
  private config: SimproConfig

  constructor(
    accessToken: string, 
    config: SimproConfig
  ) {
    this.accessToken = accessToken
    this.config = config
  }

  // Token refresh removed - using permanent tokens

  /**
   * Make an authenticated request to the Simpro API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<ApiResponse> {
    // Check if endpoint already includes the base URL
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${this.config.baseUrl}${endpoint}`
      
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (response.status === 401) {
        throw new AppError(
          ERROR_CODES.AUTH_SESSION_EXPIRED,
          401,
          { provider: 'simpro' },
          'Authentication failed: Invalid or expired access token',
          [{ action: 'updateConnection', label: 'Update Connection', data: { provider: 'simpro' } }]
        )
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new AppError(
          ERROR_CODES.SYS_SERVER_ERROR,
          response.status,
          { 
            endpoint, 
            statusCode: response.status, 
            statusText: response.statusText,
            errorText
          },
          `API request failed: ${response.statusText} (${response.status})`
        )
      }

      const data = await response.json()
      return data as ApiResponse
    } catch (error) {
      throw error
    }
  }

  /**
   * Test the API connection
   */
  async testConnection() {
    try {
      return this.makeRequest('/companies/0')
    } catch (error) {
      console.error('Error testing connection:', error)
      throw error
    }
  }

  /**
   * Get list of employees from Simpro
   */
  async getEmployees(): Promise<Employee[]> {
    console.log('🔍 [SimproAPI] Fetching employees from Simpro...')
    try {
      const response = await this.makeRequest('/companies/0/employees/')
      const employees = response as Employee[]
      console.log('🔍 [SimproAPI] Simpro returned employees:', {
        count: employees.length,
        sample: employees[0] || null,
        baseUrl: this.config.baseUrl
      })
      return employees
    } catch (error) {
      console.error('🔍 [SimproAPI] Error fetching employees:', error)
      throw error
    }
  }

  /**
   * Get detailed employee information including availability
   */
  async getEmployeeDetails(employeeId: number): Promise<any> {
    try {
      const response = await this.makeRequest(`/companies/0/employees/${employeeId}`)
      return response
    } catch (error) {
      console.error('Error fetching employee details:', error)
      throw error
    }
  }

  /**
   * Get employee availability for a date range
   */
  async getEmployeeAvailability(request: EmployeeAvailabilityRequest): Promise<any[]> {
    const { employeeId, startDate, endDate } = request
    try {
      const response = await this.makeRequest(
        `/companies/0/employees/${employeeId}/timesheets/?StartDate=${startDate}&EndDate=${endDate}`
      )
      return response as any[]
    } catch (error) {
      console.error('Error fetching employee availability:', error)
      throw error
    }
  }

  /**
   * Get company-wide schedules for a date range
   */
  async getSchedules(filters?: { staffId?: number; startDate?: string; endDate?: string }): Promise<any[]> {
    let url = '/companies/0/schedules/'
    const params: string[] = []
    
    if (filters?.staffId) {
      params.push(`Staff.ID=${filters.staffId}`)
    }
    
    if (filters?.startDate && filters?.endDate) {
      params.push(`Date=between(${filters.startDate},${filters.endDate})`)
    }
    
    if (params.length > 0) {
      url += '?' + params.join('&')
    }
    
    console.log('📅 [SIMPRO API] Fetching schedules from:', url)
    
    try {
      const response = await this.makeRequest(url)
      return response as any[]
    } catch (error) {
      console.error('Error fetching company schedules:', error)
      throw error
    }
  }

  /**
   * Create a customer in Simpro
   */
  async createCustomer(customerData: CreateCustomerRequest, createSite: boolean = false): Promise<Customer> {
    console.log('Creating customer with data:', customerData)
    console.log('createSite parameter:', createSite)
    
    // Construct the endpoint without the base URL
    const endpoint = `/companies/0/customers/individuals/?createSite=${createSite}`
    console.log('Customer creation endpoint:', endpoint)
    
    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(customerData),
    })
    
    console.log('Customer creation response:', response)
    return response as Customer
  }

  /**
   * Create a job in Simpro
   */
  async createJob(jobData: CreateJobRequest): Promise<Job> {
    
    // Check if properties are lowercase and create normalized version
    const normalizedData = {
      Type: jobData.Type,
      Name: jobData.Name,
      Description: jobData.Description,
      Customer: jobData.Customer,
      Site: jobData.Site
    } as any
    
    // Include Notes field if present
    if ('Notes' in jobData && (jobData as any).Notes) {
      normalizedData.Notes = (jobData as any).Notes
    }
    
    // According to the documentation, valid job types are: "Service", "Project", "Prepaid"
    const validJobTypes = ['Service', 'Project', 'Prepaid'] as const
    if (!normalizedData.Type || !validJobTypes.includes(normalizedData.Type)) {
      console.error('Invalid or missing job type:', normalizedData.Type)
      console.error('Valid job types are:', validJobTypes)
      throw new Error(`Invalid job type. Must be one of: ${validJobTypes.join(', ')}`)
    }
    
    
    const response = await this.makeRequest('/companies/0/jobs/', {
      method: 'POST',
      body: JSON.stringify(normalizedData),
    })

    return response as Job
  }

  /**
   * Get job details including cost centers
   */
  async getJobDetails(jobId: number) {
    return this.makeRequest(`/companies/0/jobs/${jobId}/costCenters/`)
  }

  /**
   * Create a section for a job
   */
  async createSection(jobId: number) {
    return this.makeRequest(`/companies/0/jobs/${jobId}/sections/`, {
      method: 'POST',
      body: JSON.stringify({})
    })
  }

  /**
   * Create a cost center for a job
   */
  async createCostCenter(jobId: number) {
    return this.makeRequest(`/companies/0/jobs/${jobId}/costCenters/`, {
      method: 'POST',
      body: JSON.stringify({
        Name: 'Default Cost Center'
      })
    })
  }

  /**
   * Schedule a job with an employee
   */
  async scheduleJob(jobId: number, scheduleData: ScheduleJobRequest): Promise<Schedule> {
    // First create a section
    const sectionResponse = await this.createSection(jobId)
    const sectionId = sectionResponse.ID

    // Create a cost center in the section using template ID 4
    const costCenterResponse = await this.makeRequest(`/companies/0/jobs/${jobId}/sections/${sectionId}/costCenters/`, {
      method: 'POST',
      body: JSON.stringify({
        CostCenter: 4, // Use cost center template ID 4
        Name: "Default Cost Center"
      })
    })
    const costCenterId = costCenterResponse.ID

    // Finally schedule using the section and cost center IDs
    // Extract the date from the first block
    const date = scheduleData.Blocks[0].Date
    const blocks = scheduleData.Blocks.map(block => ({
      StartTime: block.StartTime,
      EndTime: block.EndTime,
      ScheduleRate: 1 // Use default schedule rate
    }))

    const response = await this.makeRequest(`/companies/0/jobs/${jobId}/sections/${sectionId}/costCenters/${costCenterId}/schedules/`, {
      method: 'POST',
      body: JSON.stringify({
        Staff: scheduleData.Staff,
        Date: date,
        Blocks: blocks
      }),
    })

    return response as Schedule
  }

  /**
   * Create a site for a customer
   */
  async createSite(customerId: number, siteData: {
    Name: string
    Address: {
      Address: string
      City: string
      State: string
      PostalCode: string
      Country: string
    }
  }) {
    return this.makeRequest(`/companies/0/customers/${customerId}/sites/`, {
      method: 'POST',
      body: JSON.stringify(siteData),
    })
  }

  /**
   * Get build information (multi-company, version, etc.)
   */
  async getBuildInfo() {
    try {
      return this.makeRequest('/info/')
    } catch (error) {
      console.error('Error fetching build info:', error)
      throw error
    }
  }

  /**
   * Get list of companies
   */
  async getCompanies() {
    try {
      const response = await this.makeRequest('/companies/')
      return response
    } catch (error) {
      console.error('Error fetching companies:', error)
      throw error
    }
  }

  /**
   * Get detailed company information
   */
  async getCompanyDetails(companyId: string = '0') {
    try {
      const response = await this.makeRequest(`/companies/${companyId}`)
      return response
    } catch (error) {
      console.error(`Error fetching company details for ${companyId}:`, error)
      throw error
    }
  }

  /**
   * Find customer by email with pagination support
   */
  async findCustomerByEmail(email: string): Promise<Customer | null> {
    try {
      let page = 1
      let hasMorePages = true
      
      while (hasMorePages) {
        const response = await this.makeRequest(
          `/companies/0/customers/?columns=ID,Email,GivenName,FamilyName,CompanyName&pageSize=250&page=${page}`
        )
        
        const customers = response as any[]
        
        // Find exact email match
        const customer = customers.find(c => c.Email === email)
        
        if (customer) {
          console.log(`Found customer ID ${customer.ID} with email: ${email} on page ${page}`)
          
          // Get full customer details - try individual first, then company
          try {
            const details = await this.makeRequest(`/companies/0/customers/individuals/${customer.ID}`)
            return details as Customer
          } catch (error) {
            // If not individual, try company
            const details = await this.makeRequest(`/companies/0/customers/companies/${customer.ID}`)
            return details as Customer
          }
        }
        
        // Check if there are more pages
        // If we got less than 250 results, we're on the last page
        hasMorePages = customers.length === 250
        page++
        
        // Safety limit to prevent infinite loops while still handling large customer bases
        // 100 pages = 25,000 customers
        if (page > 100) {
          console.warn(`Reached pagination limit of 100 pages while searching for ${email}`)
          break
        }
      }
      
      console.log(`No customer found with email: ${email} after searching ${page - 1} pages`)
      return null
    } catch (error) {
      console.error('Error finding customer by email:', error)
      return null
    }
  }

  /**
   * Find or create site for customer at address
   */
  async findOrCreateSiteForCustomer(
    customerId: number,
    address: {
      line1: string
      city: string
      state: string
      postalCode: string
      country: string
    }
  ): Promise<number> {
    try {
      // Get customer details to check existing sites
      let customerDetails: any
      try {
        customerDetails = await this.makeRequest(`/companies/0/customers/individuals/${customerId}`)
      } catch {
        customerDetails = await this.makeRequest(`/companies/0/customers/companies/${customerId}`)
      }
      
      // Check if any existing site matches the address
      if (customerDetails.Sites && customerDetails.Sites.length > 0) {
        console.log(`Customer ${customerId} has ${customerDetails.Sites.length} existing sites`)
        
        for (const site of customerDetails.Sites) {
          const siteDetails = await this.makeRequest(`/companies/0/sites/${site.ID}`)
          
          // Simple address matching using line1 (can be enhanced later)
          if (siteDetails.Address?.Address?.toLowerCase() === address.line1.toLowerCase()) {
            console.log(`Found matching site ${site.ID} with address: ${address.line1}`)
            return site.ID
          }
        }
      }
      
      // Create new site
      console.log(`Creating new site for customer ${customerId} at: ${address.line1}`)
      const newSite = await this.makeRequest('/companies/0/sites/', {
        method: 'POST',
        body: JSON.stringify({
          Name: address.line1,
          Address: {
            Address: address.line1,
            City: address.city,
            State: address.state,
            PostalCode: address.postalCode,
            Country: address.country
          },
          Customers: [customerId]
        })
      })
      
      console.log(`Created new site with ID: ${newSite.ID}`)
      return newSite.ID
    } catch (error) {
      console.error('Error finding or creating site:', error)
      throw error
    }
  }

  /**
   * Get current access token
   */
  getAccessToken(): string {
    return this.accessToken
  }
}

/**
 * Factory function to create a Simpro API instance
 */
export function createSimproApi(
  accessToken: string, 
  refreshToken: string, // Kept for compatibility but unused
  buildName: string, 
  domain: string
): SimproApi {
  const baseUrl = `https://${buildName}.${domain}`
  const config: SimproConfig = {
    baseUrl: `${baseUrl}/api/v1.0`,
    tokenUrl: `${baseUrl}/oauth2/token`,
    clientId: process.env.SIMPRO_CLIENT_ID || '',
    clientSecret: process.env.SIMPRO_CLIENT_SECRET || '',
  }

  return new SimproApi(accessToken, config)
}