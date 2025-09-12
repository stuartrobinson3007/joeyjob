import type { 
  ProviderInfoService,
  ProviderInfoServiceFactory 
} from './provider-info.interface'
import { createSimproInfoService } from './simpro-info.service'

/**
 * Registry for provider info services
 * Manages the creation and configuration of provider-specific services
 */
class ProviderInfoRegistry {
  private factories: Map<string, ProviderInfoServiceFactory> = new Map()

  constructor() {
    // Register built-in providers
    this.registerProvider('simpro', createSimproInfoService)
  }

  /**
   * Register a provider info service factory
   */
  registerProvider(providerType: string, factory: ProviderInfoServiceFactory): void {
    this.factories.set(providerType, factory)
  }

  /**
   * Create a provider info service instance
   */
  createService(
    providerType: string,
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
  ): ProviderInfoService {
    const factory = this.factories.get(providerType)
    if (!factory) {
      throw new Error(`Unknown provider type: ${providerType}`)
    }

    return factory(accessToken, refreshToken, buildConfig, userId, onTokenRefresh)
  }

  /**
   * Get list of supported provider types
   */
  getSupportedProviders(): string[] {
    return Array.from(this.factories.keys())
  }

  /**
   * Check if a provider type is supported
   */
  isProviderSupported(providerType: string): boolean {
    return this.factories.has(providerType)
  }
}

// Export singleton instance
export const providerInfoRegistry = new ProviderInfoRegistry()

/**
 * Convenience function to create a provider info service
 */
export function createProviderInfoService(
  providerType: string,
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
): ProviderInfoService {
  return providerInfoRegistry.createService(
    providerType,
    accessToken,
    refreshToken,
    buildConfig,
    userId,
    onTokenRefresh
  )
}