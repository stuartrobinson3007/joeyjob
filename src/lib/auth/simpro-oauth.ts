interface OAuth2Tokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

export interface SimProBuildConfig {
  buildName: string
  domain: 'simprosuite.com' | 'simprocloud.com'
  baseUrl: string
}

export interface SimProUser {
  ID: string
  CompanyID: string
  Name: string
  Email?: string
  Active?: boolean
}

/**
 * Creates a SimPro OAuth configuration for Better Auth
 * Supports dynamic build URLs based on user selection
 */
export function createSimProOAuthConfig(buildConfig: SimProBuildConfig) {
  const { baseUrl } = buildConfig
  
  return {
    providerId: 'simpro',
    clientId: process.env.SIMPRO_CLIENT_ID!,
    clientSecret: process.env.SIMPRO_CLIENT_SECRET!,
    authorizationUrl: `${baseUrl}/oauth2/login`,
    tokenUrl: `${baseUrl}/oauth2/token`,
    scopes: [], // SimPro doesn't use scopes
    redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/oauth2/callback/simpro`,
    
    // Custom function to fetch user info from SimPro API
    getUserInfo: async (tokens: OAuth2Tokens) => {
      try {
        const response = await fetch(`${baseUrl}/api/v1.0/currentUser/`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        })
        
        if (!response.ok) {
          throw new Error(`SimPro API error: ${response.status}`)
        }
        
        const simproUser = await response.json() as SimProUser
        
        // Generate placeholder email since SimPro doesn't provide emails
        const placeholderEmail = `simpro${simproUser.ID}@${buildConfig.buildName}.joeyjob.com`
        
        return {
          id: simproUser.ID,
          name: simproUser.Name,
          email: placeholderEmail,
          emailVerified: false,
          simproBuildName: buildConfig.buildName,
          simproDomain: buildConfig.domain,
          simproCompanyId: simproUser.CompanyID,
        }
      } catch (error) {
        console.error('Error fetching SimPro user info:', error)
        throw error
      }
    },
    
    // Map SimPro profile to Better Auth user
    mapProfileToUser: async (profile: any) => {
      return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        // Store SimPro-specific data in user metadata
        // These will need to be added to the user schema
        simproBuildName: profile.simproBuildName,
        simproDomain: profile.simproDomain,
        simproId: profile.id,
        simproCompanyId: profile.simproCompanyId,
      }
    },
  }
}


/**
 * Helper to construct SimPro base URL from build configuration
 */
export function getSimProBaseUrl(buildName: string, domain: string): string {
  return `https://${buildName}.${domain}`
}

/**
 * Validates a build configuration by checking if the OAuth endpoint is accessible
 */
export async function validateSimProBuild(buildConfig: SimProBuildConfig): Promise<boolean> {
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