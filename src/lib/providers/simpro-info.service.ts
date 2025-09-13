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

  constructor(
    accessToken: string,
    refreshToken: string,
    buildConfig: {
      buildName: string
      domain: string
      baseUrl: string
    },
    userId?: string,
    onTokenRefresh?: (
      accessToken: string,
      refreshToken: string,
      accessTokenExpiresAt: number,
      refreshTokenExpiresAt: number
    ) => Promise<void>
  ) {
    this.simproApi = createSimproApi(
      accessToken,
      refreshToken,
      buildConfig.buildName,
      buildConfig.domain,
      userId,
      onTokenRefresh
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
          city: undefined, // Not provided by Simpro API
          state: undefined, // Not provided by Simpro API
          postalCode: undefined, // Not provided by Simpro API
          country: response.Country || undefined, // From root level
        } : undefined,
        providerData: {
          // Store Simpro-specific fields that don't map to standard fields
          ein: response.EIN,
          companyNo: response.CompanyNo,
          licence: response.Licence,
          banking: response.Banking,
          cisertNo: response.CISCertNo,
          employerTaxRefNo: response.EmployerTaxRefNo,
          timezoneOffset: response.TimezoneOffset,
          defaultLanguage: response.DefaultLanguage,
          template: response.Template,
          multiCompanyLabel: response.MultiCompanyLabel,
          multiCompanyColor: response.MultiCompanyColor,
          country: response.Country,
          taxName: response.TaxName,
          uiDateFormat: response.UIDateFormat,
          uiTimeFormat: response.UITimeFormat,
          scheduleFormat: response.ScheduleFormat,
          singleCostCenterMode: response.SingleCostCenterMode,
          dateModified: response.DateModified,
          defaultCostCenter: response.DefaultCostCenter,
          // Also store billing address if different
          billingAddress: response.BillingAddress,
        }
      }
      
      
      return companyInfo
    } catch (error) {
      console.error(`Error fetching Simpro company info for company ${companyId}:`, error)
      throw error
    }
  }

  async getEmployees(companyId: string = '0'): Promise<Employee[]> {
    try {
      const employees = await this.simproApi.getEmployees()
      
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
  refreshToken: string,
  buildConfig: {
    buildName: string
    domain: string
    baseUrl: string
  },
  userId?: string,
  onTokenRefresh?: (
    accessToken: string,
    refreshToken: string,
    accessTokenExpiresAt: number,
    refreshTokenExpiresAt: number
  ) => Promise<void>
): SimproInfoService {
  return new SimproInfoService(
    accessToken,
    refreshToken,
    buildConfig,
    userId,
    onTokenRefresh
  )
}