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
  const search = useSearch({ from: '/_all-pages/auth/update-connection' }) as UpdateConnectionSearch
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

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
              Back
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