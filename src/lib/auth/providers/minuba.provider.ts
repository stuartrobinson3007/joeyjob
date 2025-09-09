import type { 
  AuthProvider, 
  AuthProviderConfig, 
  AuthProviderUser, 
  BuildConfig 
} from './auth-provider.interface'

/**
 * Minuba authentication provider implementation
 * TODO: Complete implementation once Minuba API documentation is available
 * Contact partner@minuba.dk for API access
 */
export class MinubaProvider implements AuthProvider {
  config: AuthProviderConfig

  constructor(config: Partial<AuthProviderConfig> = {}) {
    this.config = {
      providerId: 'minuba',
      displayName: 'Minuba',
      requiresBuildSelection: false, // May need to be updated based on Minuba's architecture
      clientId: process.env.MINUBA_CLIENT_ID || '',
      clientSecret: process.env.MINUBA_CLIENT_SECRET || '',
      scopes: ['read:user', 'read:organization'], // Update based on actual Minuba scopes
      ...config,
    }
  }

  getAuthorizationUrl(buildConfig?: BuildConfig): string {
    // TODO: Implement based on Minuba OAuth documentation
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: `${process.env.BETTER_AUTH_URL}/api/auth/callback/minuba`,
      response_type: 'code',
      scope: this.config.scopes?.join(' ') || '',
    })
    
    // Update with actual Minuba OAuth URL
    const baseUrl = buildConfig?.baseUrl || 'https://api.minuba.dk'
    return `${baseUrl}/oauth/authorize?${params.toString()}`
  }

  getTokenUrl(buildConfig?: BuildConfig): string {
    // TODO: Update with actual Minuba token endpoint
    const baseUrl = buildConfig?.baseUrl || 'https://api.minuba.dk'
    return `${baseUrl}/oauth/token`
  }

  async exchangeCodeForTokens(
    code: string,
    buildConfig?: BuildConfig
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    // TODO: Implement token exchange based on Minuba API
    const response = await fetch(this.getTokenUrl(buildConfig), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret || '',
        redirect_uri: `${process.env.BETTER_AUTH_URL}/api/auth/callback/minuba`,
      }),
    })

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`)
    }

    const data = await response.json()
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    }
  }

  async getUserInfo(
    accessToken: string,
    buildConfig?: BuildConfig
  ): Promise<AuthProviderUser> {
    // TODO: Implement user info fetching based on Minuba API
    const baseUrl = buildConfig?.baseUrl || 'https://api.minuba.dk'
    
    const response = await fetch(`${baseUrl}/api/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`)
    }

    const minubaUser = await response.json()
    
    // Map Minuba user data to our interface
    // Update field mappings based on actual Minuba response
    return {
      id: minubaUser.id || minubaUser.userId,
      name: minubaUser.name || `${minubaUser.firstName} ${minubaUser.lastName}`,
      email: minubaUser.email,
      companyId: minubaUser.organizationId || minubaUser.companyId,
      metadata: {
        // Add any Minuba-specific user metadata
      },
    }
  }

  async refreshToken(
    refreshToken: string,
    buildConfig?: BuildConfig
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    // TODO: Implement token refresh based on Minuba API
    const response = await fetch(this.getTokenUrl(buildConfig), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret || '',
      }),
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`)
    }

    const data = await response.json()
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    }
  }

  mapToUser(providerUser: AuthProviderUser) {
    return {
      name: providerUser.name,
      email: providerUser.email,
      minubaId: providerUser.id,
      minubaCompanyId: providerUser.companyId,
    }
  }
}

// Create and export a singleton instance
// This will be activated once Minuba integration is ready
export const minubaProvider = new MinubaProvider()