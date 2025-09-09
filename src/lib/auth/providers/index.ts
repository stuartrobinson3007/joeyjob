export * from './auth-provider.interface'
export * from './simpro.provider'
export * from './minuba.provider'

import { AuthProviderRegistry } from './auth-provider.interface'
import { simproProvider } from './simpro.provider'
// import { minubaProvider } from './minuba.provider' // Uncomment when ready

// Register all providers
AuthProviderRegistry.register(simproProvider)
// AuthProviderRegistry.register(minubaProvider) // Uncomment when ready

export { AuthProviderRegistry }