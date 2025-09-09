import { useState } from 'react'
import { Building2 } from 'lucide-react'

import { authClient } from '@/lib/auth/auth-client'
import { SimProBuildSelector } from './simpro-build-selector'
import type { SimProBuildConfig } from '@/lib/auth/simpro-oauth'

export function SimProSignIn() {
  const [showBuildSelector, setShowBuildSelector] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check if we have a stored build configuration
  const storedConfig = sessionStorage.getItem('simpro_build_config')
  const hasBuildConfig = !!storedConfig

  const handleSignIn = async (buildConfig?: SimProBuildConfig) => {
    setIsLoading(true)
    
    try {
      // If no build config provided, use the stored one
      const config = buildConfig || (storedConfig ? JSON.parse(storedConfig) : null)
      
      if (!config) {
        setShowBuildSelector(true)
        setIsLoading(false)
        return
      }

      // Store the build config for the callback
      sessionStorage.setItem('simpro_build_config', JSON.stringify(config))
      
      // Initiate OAuth flow with SimPro using generic OAuth
      await authClient.signIn.oauth2({
        providerId: 'simpro',
        callbackURL: '/',
      })
    } catch (error) {
      console.error('SimPro sign-in error:', error)
      setIsLoading(false)
    }
  }

  const handleBuildSelected = async (buildConfig: SimProBuildConfig) => {
    await handleSignIn(buildConfig)
  }

  const handleChangeBuild = () => {
    sessionStorage.removeItem('simpro_build_config')
    setShowBuildSelector(true)
  }

  if (showBuildSelector || !hasBuildConfig) {
    return (
      <SimProBuildSelector 
        onBuildSelected={handleBuildSelected}
        isLoading={isLoading}
      />
    )
  }

  // Parse stored config to show current build
  const currentConfig = storedConfig ? JSON.parse(storedConfig) as SimProBuildConfig : null

  return (
    <div className="space-y-4">
      <button
        onClick={() => handleSignIn()}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        <Building2 className="h-5 w-5" />
        <span>Sign in with SimPro</span>
      </button>

      {currentConfig && (
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Connected to: <span className="font-semibold">{currentConfig.buildName}.{currentConfig.domain}</span>
          </p>
          <button
            onClick={handleChangeBuild}
            className="text-xs text-primary hover:underline"
            disabled={isLoading}
          >
            Change build
          </button>
        </div>
      )}
    </div>
  )
}