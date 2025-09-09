import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/oauth2/accessCode')({
  component: OAuthCallback,
})

function OAuthCallback() {
  useEffect(() => {
    // This route receives the OAuth callback from SimPro
    // and forwards it to Better Auth's expected callback endpoint
    
    // Get the current URL parameters
    const searchParams = window.location.search
    
    // Redirect to Better Auth's generic OAuth callback handler
    // Better Auth expects callbacks at /api/auth/oauth2/callback/:providerId
    window.location.href = `/api/auth/oauth2/callback/simpro${searchParams}`
  }, [])
  
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Completing authentication...</h2>
        <p className="text-muted-foreground mt-2">Please wait while we redirect you.</p>
      </div>
    </div>
  )
}