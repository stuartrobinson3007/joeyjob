import type { 
  ProviderInfoService, 
  CompanyInfo, 
  Employee 
} from './provider-info.interface'
import { createSimproApi } from '../simpro/simpro-api'
import type { SimproApi } from '../simpro/simpro-api'

/**
 * Simpro implementation of ProviderInfoService
 * Fetches company and employee information from Simpro API
 */
export class SimproInfoService implements ProviderInfoService {
  private simproApi: SimproApi
  private buildConfig: {
    buildName: string
    domain: string
    baseUrl: string
  }

  constructor(
    accessToken: string,
    buildConfig: {
      buildName: string
      domain: string
      baseUrl: string
    }
  ) {
    this.buildConfig = buildConfig
    this.simproApi = createSimproApi(
      accessToken,
      '', // No refresh token needed
      buildConfig.buildName,
      buildConfig.domain
    )
  }

  async getBuildInfo() {
    try {
      const buildInfo = await this.simproApi.getBuildInfo()
      
      return {
        isMultiCompany: buildInfo.MultiCompany || false,
        defaultCompanyId: buildInfo.MultiCompany ? undefined : '0',
        buildVersion: buildInfo.Version,
        metadata: {
          country: buildInfo.Country,
          maintenancePlanner: buildInfo.MaintenancePlanner,
          sharedCatalog: buildInfo.SharedCatalog,
          sharedStock: buildInfo.SharedStock,
          sharedClients: buildInfo.SharedClients,
          sharedSetup: buildInfo.SharedSetup,
          sharedDefaults: buildInfo.SharedDefaults,
          sharedAccountsIntegration: buildInfo.SharedAccountsIntegration,
        }
      }
    } catch (error) {
      console.error('Error fetching Simpro build info:', error)
      throw error
    }
  }

  async isMultiCompany(): Promise<boolean> {
    const buildInfo = await this.getBuildInfo()
    return buildInfo.isMultiCompany
  }

  async getCompanies(): Promise<CompanyInfo[]> {
    try {
      // Get companies list
      const companiesResponse = await this.simproApi.getCompanies()
      const companies = Array.isArray(companiesResponse) ? companiesResponse : [companiesResponse]
      
      // Get detailed info for each company
      const companyInfoPromises = companies.map(company => 
        this.getCompanyInfo(company.ID.toString())
      )
      
      return await Promise.all(companyInfoPromises)
    } catch (error) {
      console.error('Error fetching Simpro companies:', error)
      throw error
    }
  }

  async getCompanyInfo(companyId: string = '0'): Promise<CompanyInfo> {
    try {
      const response = await this.simproApi.getCompanyDetails(companyId)
      
      
      const companyInfo = {
        id: response.ID.toString(),
        name: response.Name || '',
        phone: response.Phone || undefined,
        email: response.Email || undefined,
        website: response.Website || undefined,
        currency: response.Currency || undefined,
        timezone: response.Timezone || undefined,
        address: response.Address ? {
          line1: response.Address.Line1 || undefined,
          line2: response.Address.Line2 || undefined,
          city: response.Address.City || undefined,
          state: response.Address.State || undefined,
          postalCode: response.Address.PostalCode || undefined,
          country: response.Country || undefined, // From root level
        } : undefined,
        providerData: {
          // Only store build configuration needed for API access
          buildName: this.buildConfig.buildName,
          domain: this.buildConfig.domain,
        }
      }
      
      
      return companyInfo
    } catch (error) {
      console.error(`Error fetching Simpro company info for company ${companyId}:`, error)
      throw error
    }
  }

  async getEmployees(companyId: string = '0'): Promise<Employee[]> {
    console.log('🔍 [SimproInfoService] Getting employees for company:', companyId)
    try {
      const employees = await this.simproApi.getEmployees()
      
      console.log('🔍 [SimproInfoService] Mapping employees:', {
        rawCount: employees.length,
        sample: employees[0] || null
      })
      
      return employees.map(emp => ({
        id: emp.ID,
        name: emp.Name || `Employee ${emp.ID}`,
        email: emp.Email || undefined,
        isActive: emp.Active !== false, // Default to true if not specified
        metadata: {
          simproId: emp.ID,
          // Store any other Simpro-specific employee fields
          ...emp
        }
      }))
    } catch (error) {
      console.error(`Error fetching Simpro employees for company ${companyId}:`, error)
      throw error
    }
  }
}

/**
 * Factory function to create SimproInfoService instances
 */
export function createSimproInfoService(
  accessToken: string,
  refreshToken: string, // Kept for compatibility but unused
  buildConfig: {
    buildName: string
    domain: string
    baseUrl: string
  },
  userId?: string, // Kept for compatibility but unused
  onTokenRefresh?: any // Kept for compatibility but unused
): SimproInfoService {
  return new SimproInfoService(
    accessToken,
    buildConfig
  )
}