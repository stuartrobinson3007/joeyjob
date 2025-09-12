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

/**
 * Simpro API client for interacting with Simpro services
 * Handles authentication, token refresh, and API calls
 */
export class SimproApi {
  private accessToken: string
  private refreshToken: string
  private tokenExpiry: number = 0
  private config: SimproConfig
  private userId?: string
  private onTokenRefresh?: (
    accessToken: string, 
    refreshToken: string, 
    accessTokenExpiresAt: number,
    refreshTokenExpiresAt: number
  ) => Promise<void>

  constructor(
    accessToken: string, 
    refreshToken: string, 
    config: SimproConfig,
    userId?: string,
    onTokenRefresh?: (
      accessToken: string, 
      refreshToken: string, 
      accessTokenExpiresAt: number,
      refreshTokenExpiresAt: number
    ) => Promise<void>
  ) {
    console.log('Initializing SimproApi with tokens:', {
      accessToken: accessToken ? 'Present' : 'Missing',
      refreshToken: refreshToken ? 'Present' : 'Missing',
      baseUrl: config.baseUrl,
      userId: userId || 'Not provided'
    })
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.config = config
    this.userId = userId
    this.onTokenRefresh = onTokenRefresh
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    console.log('Starting token refresh...')
    
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available')
      }

      console.log('Using refresh token for:', this.config.baseUrl)
      
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      })

      console.log('Token refresh response status:', response.status)

      let responseData
      try {
        const responseText = await response.text()
        console.log('Token refresh response text:', responseText)
        responseData = responseText ? JSON.parse(responseText) : {}
      } catch (error) {
        console.error('Failed to parse response:', error)
        responseData = {}
      }

      if (!response.ok) {
        const errorData = responseData as TokenErrorResponse
        throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error || response.statusText}`)
      }

      const data = responseData as TokenResponse
      console.log('Token refresh response data:', data)

      if (!data.access_token || !data.refresh_token) {
        throw new Error('Invalid token response: missing access_token or refresh_token')
      }

      this.accessToken = data.access_token
      this.refreshToken = data.refresh_token
      this.tokenExpiry = Date.now() + (data.expires_in * 1000)
      
      // Calculate refresh token expiry (14 days from now according to SimPro docs)
      const refreshTokenExpiresAt = Date.now() + (14 * 24 * 60 * 60 * 1000)

      console.log('Token refresh successful. New tokens state:', {
        accessToken: this.accessToken ? 'Present' : 'Missing',
        refreshToken: this.refreshToken ? 'Present' : 'Missing',
        tokenExpiry: new Date(this.tokenExpiry).toISOString(),
        refreshTokenExpiry: new Date(refreshTokenExpiresAt).toISOString()
      })
      
      // Persist the new tokens to database if callback provided
      if (this.onTokenRefresh && this.userId) {
        console.log('Persisting new tokens to database for user:', this.userId)
        try {
          await this.onTokenRefresh(
            this.accessToken,
            this.refreshToken,
            this.tokenExpiry,
            refreshTokenExpiresAt
          )
          console.log('✅ Tokens successfully persisted to database')
        } catch (error) {
          console.error('❌ Failed to persist tokens to database:', error)
          // Continue anyway - at least we have the tokens in memory for this request
        }
      } else {
        console.warn('⚠️ Token refresh callback not provided - tokens not persisted to database!')
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      throw error
    }
  }

  /**
   * Make an authenticated request to the Simpro API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}, retryCount: number = 0): Promise<ApiResponse> {
    console.log('makeRequest called with endpoint:', endpoint)
    console.log('baseUrl:', this.config.baseUrl)
    
    // Check if endpoint already includes the base URL
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${this.config.baseUrl}${endpoint}`
      
    console.log('Constructed URL:', url)
    console.log('Current access token:', this.accessToken ? 'Present' : 'Missing')
    
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }
    
    console.log('Request headers:', headers)
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (response.status === 401 && retryCount === 0) {
        console.log('Received 401, attempting token refresh...')
        await this.refreshAccessToken()
        // Retry the request with new token (only once)
        return this.makeRequest(endpoint, options, retryCount + 1)
      }

      if (response.status === 401 && retryCount > 0) {
        console.error('Authentication failed after token refresh - token may be invalid')
        throw new Error('Authentication failed: Unable to refresh access token')
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API request failed: ${response.status} ${response.statusText}`)
        console.error('Error details:', errorText)
        throw new Error(`API request failed: ${response.statusText} (${response.status})`)
      }

      const data = await response.json()
      console.log('Response data:', data)
      return data as ApiResponse
    } catch (error) {
      console.error('Request failed:', error)
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
    try {
      const response = await this.makeRequest('/companies/0/employees/')
      return response as Employee[]
    } catch (error) {
      console.error('Error fetching employees:', error)
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
    console.log('Original job data received:', jobData)
    
    // Check if properties are lowercase and create normalized version
    const normalizedData = {
      Type: jobData.Type,
      Name: jobData.Name,
      Description: jobData.Description,
      Customer: jobData.Customer,
      Site: jobData.Site
    }
    
    console.log('Normalized job data:', normalizedData)
    
    // According to the documentation, valid job types are: "Service", "Project", "Prepaid"
    const validJobTypes = ['Service', 'Project', 'Prepaid'] as const
    if (!normalizedData.Type || !validJobTypes.includes(normalizedData.Type)) {
      console.error('Invalid or missing job type:', normalizedData.Type)
      console.error('Valid job types are:', validJobTypes)
      throw new Error(`Invalid job type. Must be one of: ${validJobTypes.join(', ')}`)
    }
    
    // Log the exact structure being sent
    const requestBody = JSON.stringify(normalizedData)
    console.log('Final request body:', requestBody)
    console.log('Request body parsed back:', JSON.parse(requestBody))
    
    const response = await this.makeRequest('/companies/0/jobs/', {
      method: 'POST',
      body: requestBody,
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
   * Get current refresh token (for storage)
   */
  getRefreshToken(): string {
    return this.refreshToken
  }

  /**
   * Get current access token
   */
  getAccessToken(): string {
    return this.accessToken
  }
}

/**
 * Factory function to create a Simpro API instance from user credentials
 */
export function createSimproApi(
  accessToken: string, 
  refreshToken: string, 
  buildName: string, 
  domain: string,
  userId?: string,
  onTokenRefresh?: (
    accessToken: string, 
    refreshToken: string, 
    accessTokenExpiresAt: number,
    refreshTokenExpiresAt: number
  ) => Promise<void>
): SimproApi {
  const baseUrl = `https://${buildName}.${domain}`
  const config: SimproConfig = {
    baseUrl: `${baseUrl}/api/v1.0`,
    tokenUrl: `${baseUrl}/oauth2/token`,
    clientId: process.env.SIMPRO_CLIENT_ID || '',
    clientSecret: process.env.SIMPRO_CLIENT_SECRET || '',
  }

  return new SimproApi(accessToken, refreshToken, config, userId, onTokenRefresh)
}