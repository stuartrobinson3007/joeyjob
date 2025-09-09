/**
 * Auth Provider Interface
 * Defines the contract for implementing custom authentication providers
 * This allows for easy addition of new providers like SimPro, Minuba, etc.
 */

export interface AuthProviderConfig {
  /**
   * Unique identifier for the provider
   */
  providerId: string
  
  /**
   * Display name for the provider
   */
  displayName: string
  
  /**
   * Whether this provider requires build/tenant selection
   */
  requiresBuildSelection?: boolean
  
  /**
   * OAuth client ID
   */
  clientId: string
  
  /**
   * OAuth client secret (server-side only)
   */
  clientSecret?: string
  
  /**
   * OAuth scopes to request
   */
  scopes?: string[]
  
  /**
   * Icon component or URL for the provider
   */
  icon?: string | React.ComponentType
}

export interface BuildConfig {
  /**
   * The build/tenant identifier
   */
  buildName: string
  
  /**
   * The domain for the build
   */
  domain: string
  
  /**
   * Full base URL for the build
   */
  baseUrl: string
  
  /**
   * Additional provider-specific configuration
   */
  metadata?: Record<string, any>
}

export interface AuthProviderUser {
  /**
   * Provider-specific user ID
   */
  id: string
  
  /**
   * User's display name
   */
  name: string
  
  /**
   * User's email (can be placeholder if not provided)
   */
  email: string
  
  /**
   * Provider-specific build/tenant name
   */
  buildName?: string
  
  /**
   * Provider-specific domain
   */
  domain?: string
  
  /**
   * Provider-specific company/organization ID
   */
  companyId?: string
  
  /**
   * Additional provider-specific user data
   */
  metadata?: Record<string, any>
}

export interface AuthProvider {
  /**
   * Provider configuration
   */
  config: AuthProviderConfig
  
  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(buildConfig?: BuildConfig): string
  
  /**
   * Get OAuth token exchange URL
   */
  getTokenUrl(buildConfig?: BuildConfig): string
  
  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(
    code: string,
    buildConfig?: BuildConfig
  ): Promise<{
    accessToken: string
    refreshToken?: string
    expiresIn?: number
  }>
  
  /**
   * Get user information from the provider
   */
  getUserInfo(
    accessToken: string,
    buildConfig?: BuildConfig
  ): Promise<AuthProviderUser>
  
  /**
   * Refresh access token
   */
  refreshToken?(
    refreshToken: string,
    buildConfig?: BuildConfig
  ): Promise<{
    accessToken: string
    refreshToken?: string
    expiresIn?: number
  }>
  
  /**
   * Validate build configuration (optional)
   */
  validateBuildConfig?(buildConfig: BuildConfig): Promise<boolean>
  
  /**
   * Map provider user to application user schema
   */
  mapToUser(providerUser: AuthProviderUser): {
    name: string
    email: string
    [key: string]: any
  }
}

/**
 * Factory function to create auth provider instances
 */
export type AuthProviderFactory = (config: AuthProviderConfig) => AuthProvider

/**
 * Registry for auth providers
 */
export class AuthProviderRegistry {
  private static providers = new Map<string, AuthProvider>()
  
  /**
   * Register a new auth provider
   */
  static register(provider: AuthProvider): void {
    this.providers.set(provider.config.providerId, provider)
  }
  
  /**
   * Get an auth provider by ID
   */
  static get(providerId: string): AuthProvider | undefined {
    return this.providers.get(providerId)
  }
  
  /**
   * Get all registered providers
   */
  static getAll(): AuthProvider[] {
    return Array.from(this.providers.values())
  }
  
  /**
   * Check if a provider is registered
   */
  static has(providerId: string): boolean {
    return this.providers.has(providerId)
  }
}