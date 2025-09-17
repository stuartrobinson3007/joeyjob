import { validateRedirectUrl } from './update-connection'
import { SimProBuildSelector } from './simpro-build-selector'

interface SimProSignInProps {
  redirectTo?: string
}

export function SimProSignIn({ redirectTo }: SimProSignInProps = {}) {
  // Validate and sanitize the redirect URL
  const validatedRedirectTo = validateRedirectUrl(redirectTo)
  
  // Always show the build selector directly - it now handles everything including OAuth
  return (
    <SimProBuildSelector 
      redirectTo={validatedRedirectTo || '/'}
    />
  )
}