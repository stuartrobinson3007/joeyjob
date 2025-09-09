import type { 
  AuthProvider, 
  AuthProviderConfig, 
  AuthProviderUser, 
  BuildConfig 
} from './auth-provider.interface'

/**
 * SimPro authentication provider implementation
 */
export class SimProProvider implements AuthProvider {
  config: AuthProviderConfig

  constructor(config: Partial<AuthProviderConfig> = {}) {
    this.config = {
      providerId: 'simpro',
      displayName: 'SimPro',
      requiresBuildSelection: true,
      clientId: process.env.SIMPRO_CLIENT_ID || process.env.VITE_SIMPRO_CLIENT_ID || '',
      clientSecret: process.env.SIMPRO_CLIENT_SECRET || '',
      scopes: [], // SimPro doesn't use scopes
      ...config,
    }
  }

  getAuthorizationUrl(buildConfig?: BuildConfig): string {
    if (!buildConfig) {
      throw new Error('Build configuration is required for SimPro')
    }
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: `${process.env.BETTER_AUTH_URL}/api/auth/oauth2/callback/simpro`,
      response_type: 'code',
      scope: this.config.scopes?.join(' ') || '',
    })
    
    return `${buildConfig.baseUrl}/oauth2/login?${params.toString()}`
  }

  getTokenUrl(buildConfig?: BuildConfig): string {
    if (!buildConfig) {
      throw new Error('Build configuration is required for SimPro')
    }
    
    return `${buildConfig.baseUrl}/oauth2/token`
  }

  async exchangeCodeForTokens(
    code: string,
    buildConfig?: BuildConfig
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    if (!buildConfig) {
      throw new Error('Build configuration is required for SimPro')
    }

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
        redirect_uri: `${process.env.BETTER_AUTH_URL}/api/auth/oauth2/callback/simpro`,
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
    if (!buildConfig) {
      throw new Error('Build configuration is required for SimPro')
    }

    const response = await fetch(`${buildConfig.baseUrl}/api/v1.0/currentUser/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`)
    }

    const simproUser = await response.json()
    
    // Generate placeholder email since SimPro doesn't provide emails
    const placeholderEmail = `simpro${simproUser.ID}@${buildConfig.buildName}.joeyjob.com`
    
    return {
      id: simproUser.ID,
      name: simproUser.Name,
      email: placeholderEmail,
      buildName: buildConfig.buildName,
      domain: buildConfig.domain,
      companyId: simproUser.CompanyID,
      metadata: {
        displayOnSchedule: simproUser.DisplayOnSchedule,
        active: simproUser.Active,
      },
    }
  }

  async refreshToken(
    refreshToken: string,
    buildConfig?: BuildConfig
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    if (!buildConfig) {
      throw new Error('Build configuration is required for SimPro')
    }

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

  async validateBuildConfig(buildConfig: BuildConfig): Promise<boolean> {
    try {
      // Try to access the OAuth authorization endpoint
      const response = await fetch(`${buildConfig.baseUrl}/oauth2/login`, {
        method: 'HEAD',
      })
      
      // If we get a response (even if it's an error), the build exists
      return response.status !== 404
    } catch (error) {
      // Network error or other issue - assume build doesn't exist
      return false
    }
  }

  mapToUser(providerUser: AuthProviderUser) {
    return {
      name: providerUser.name,
      email: providerUser.email,
      simproId: providerUser.id,
      simproBuildName: providerUser.buildName,
      simproDomain: providerUser.domain,
      simproCompanyId: providerUser.companyId,
    }
  }
}

// Create and export a singleton instance
export const simproProvider = new SimProProvider()