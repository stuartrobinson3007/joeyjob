// Export interfaces
export type {
  CompanyInfo,
  Employee,
  ProviderInfoService,
  ProviderInfoServiceFactory
} from './provider-info.interface'

// Export service implementations
export { SimproInfoService, createSimproInfoService } from './simpro-info.service'

// Export registry
export { 
  providerInfoRegistry,
  createProviderInfoService
} from './provider-registry'