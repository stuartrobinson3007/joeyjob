/**
 * Provider Info Service Interface
 * Defines the contract for fetching company information from different providers
 */

export interface CompanyInfo {
  /** Provider-specific company identifier */
  id: string
  
  /** Company name */
  name: string
  
  /** Company phone number */
  phone?: string
  
  /** Company contact email */
  email?: string
  
  /** Company website URL */
  website?: string
  
  /** Currency code (e.g., 'USD', 'AUD', 'EUR') */
  currency?: string
  
  /** Timezone identifier (e.g., 'America/New_York', 'Australia/Sydney') */
  timezone?: string
  
  /** Company address */
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  
  /** Provider-specific data that doesn't fit standard fields */
  providerData: Record<string, any>
}

export interface Employee {
  /** Provider-specific employee identifier */
  id: string | number
  
  /** Employee full name */
  name: string
  
  /** Employee email address */
  email?: string
  
  /** Whether employee is active/available */
  isActive: boolean
  
  /** Provider-specific employee data */
  metadata?: Record<string, any>
}

export interface ProviderInfoService {
  /**
   * Get information about a specific company
   * @param companyId - Provider-specific company identifier (optional for single-company builds)
   */
  getCompanyInfo(companyId?: string): Promise<CompanyInfo>
  
  /**
   * Get list of all companies the authenticated user has access to
   */
  getCompanies(): Promise<CompanyInfo[]>
  
  /**
   * Get list of employees for a company
   * @param companyId - Provider-specific company identifier (optional for single-company builds)
   */
  getEmployees(companyId?: string): Promise<Employee[]>
  
  /**
   * Check if this is a multi-company build
   */
  isMultiCompany(): Promise<boolean>
  
  /**
   * Get provider-specific build information
   */
  getBuildInfo(): Promise<{
    isMultiCompany: boolean
    defaultCompanyId?: string
    buildVersion?: string
    metadata?: Record<string, any>
  }>
}

/**
 * Factory function for creating provider info services
 */
export type ProviderInfoServiceFactory = (
  accessToken: string,
  refreshToken: string,
  buildConfig: {
    buildName: string
    domain: string
    baseUrl: string
  },
  userId?: string
) => ProviderInfoService