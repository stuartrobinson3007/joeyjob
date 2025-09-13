import { useSearch } from '@tanstack/react-router'
import { AlertCircle, RefreshCw } from 'lucide-react'

import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { SimProSignIn } from './simpro-sign-in'
// validateRedirectUrl is defined at the bottom of this file

interface UpdateConnectionSearch {
  redirectTo?: string
}

export function UpdateConnectionPage() {
  const search = useSearch({ from: '/auth/update-connection' }) as UpdateConnectionSearch
  const { redirectTo } = search

  // Detect provider intelligently
  // Check session storage for build config to determine provider
  const detectProvider = (): string => {
    if (typeof window === 'undefined') return 'simpro'
    
    // Check for Simpro build config
    if (sessionStorage.getItem('simpro_build_config')) {
      return 'simpro'
    }
    
    // Could check for other providers here:
    // if (sessionStorage.getItem('github_config')) return 'github'
    // if (sessionStorage.getItem('google_config')) return 'google'
    
    // Default to simpro for this app
    return 'simpro'
  }
  
  const provider = detectProvider()

  // Determine provider display name
  const getProviderDisplayName = (providerId: string) => {
    switch (providerId) {
      case 'simpro': return 'Simpro'
      case 'github': return 'GitHub'
      case 'google': return 'Google'
      default: return 'Provider'
    }
  }

  const providerName = getProviderDisplayName(provider)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Connection Issue Alert */}
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-orange-900 dark:text-orange-100">
                  {providerName} Connection Update Required
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Your {providerName} connection has expired and needs to be refreshed. This happens when:
            </p>
            <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1 ml-4">
              <li>• Your {providerName} refresh token has expired</li>
              <li>• Your {providerName} account permissions have changed</li>
              <li>• There was a connection issue with {providerName}</li>
            </ul>
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Please sign in again to restore your connection.
            </p>
          </CardContent>
        </Card>

        {/* Return Information */}
        {redirectTo && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  After signing in, you'll be returned to where you left off.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Provider-Specific Sign In Component */}
        {provider === 'simpro' && <SimProSignIn redirectTo={redirectTo} />}
        
        {/* Future providers can be added here */}
        {provider === 'github' && (
          <div className="text-center p-4 text-muted-foreground">
            GitHub connection update not yet implemented
          </div>
        )}
        
        {provider === 'google' && (
          <div className="text-center p-4 text-muted-foreground">
            Google connection update not yet implemented
          </div>
        )}

        {/* Manual Return Option */}
        {redirectTo && (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Navigate back without authentication (will likely redirect again)
                window.location.href = redirectTo
              }}
            >
              Return to original page
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Utility function to validate and sanitize redirect URLs
 * Prevents open redirect vulnerabilities
 */
export function validateRedirectUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  
  try {
    // Only allow relative URLs for security
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url
    }
    
    // Allow same-origin URLs (only works on client-side)
    if (typeof window !== 'undefined') {
      const parsedUrl = new URL(url, window.location.origin)
      if (parsedUrl.origin === window.location.origin) {
        return parsedUrl.pathname + parsedUrl.search + parsedUrl.hash
      }
    }
    
    return undefined
  } catch {
    return undefined
  }
}