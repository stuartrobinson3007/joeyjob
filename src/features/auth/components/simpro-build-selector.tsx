import { useState } from 'react'
import { Building2, AlertCircle } from 'lucide-react'

import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group'
import { Alert, AlertDescription } from '@/ui/alert'
import { getSimProBaseUrl, validateSimProBuild, type SimProBuildConfig } from '@/lib/auth/simpro-oauth'
import { authClient } from '@/lib/auth/auth-client'

interface SimProBuildSelectorProps {
  redirectTo?: string
  isLoading?: boolean
}

export function SimProBuildSelector({ redirectTo, isLoading }: SimProBuildSelectorProps) {
  // Load saved build config from localStorage
  const savedConfig = localStorage.getItem('simpro_build_config')
  const parsedConfig = savedConfig ? JSON.parse(savedConfig) : null
  
  const [buildName, setBuildName] = useState(parsedConfig?.buildName || '')
  const [domain, setDomain] = useState<'simprosuite.com' | 'simprocloud.com'>(
    parsedConfig?.domain || 'simprosuite.com'
  )
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    if (!buildName.trim()) {
      setError('Please enter your SimPro build name')
      return
    }

    setError(null)
    setIsValidating(true)

    const buildConfig: SimProBuildConfig = {
      buildName: buildName.trim().toLowerCase(),
      domain,
      baseUrl: getSimProBaseUrl(buildName.trim().toLowerCase(), domain),
    }

    try {
      // Optional: Validate that the build exists
      const isValid = await validateSimProBuild(buildConfig)
      
      if (!isValid) {
        setError(`Could not connect to ${buildConfig.baseUrl}. Please check your build name and domain.`)
        setIsValidating(false)
        return
      }

      // Store build config in both localStorage (for persistence) and sessionStorage (for OAuth callback)
      localStorage.setItem('simpro_build_config', JSON.stringify(buildConfig))
      sessionStorage.setItem('simpro_build_config', JSON.stringify(buildConfig))
      
      // Directly initiate OAuth flow instead of calling onBuildSelected
      await authClient.signIn.oauth2({
        providerId: 'simpro',
        callbackURL: redirectTo || '/',
      })
    } catch (error) {
      setError('Failed to connect to SimPro. Please try again.')
      console.error('SimPro connection error:', error)
      setIsValidating(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating && !isLoading) {
      handleConnect()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold">Connect to SimPro</h2>
        <p className="text-muted-foreground mt-2">
          Enter your company's SimPro build details to continue
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="build-name">Build Name</Label>
          <Input
            id="build-name"
            type="text"
            placeholder="e.g., acme or widgets"
            value={buildName}
            onChange={(e) => setBuildName(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isValidating || isLoading}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            This is the first part of your SimPro URL
          </p>
        </div>

        <div>
          <Label>Domain</Label>
          <RadioGroup
            value={domain}
            onValueChange={(value) => setDomain(value as 'simprosuite.com' | 'simprocloud.com')}
            disabled={isValidating || isLoading}
            className="mt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="simprosuite.com" id="simprosuite" />
              <Label htmlFor="simprosuite" className="font-normal cursor-pointer">
                .simprosuite.com (Default)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="simprocloud.com" id="simprocloud" />
              <Label htmlFor="simprocloud" className="font-normal cursor-pointer">
                .simprocloud.com
              </Label>
            </div>
          </RadioGroup>
        </div>

        {buildName && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Your SimPro URL will be:</span>
              <br />
              <span className="font-mono font-semibold">
                {getSimProBaseUrl(buildName.toLowerCase(), domain)}
              </span>
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleConnect}
          disabled={!buildName.trim() || isValidating || isLoading}
          className="w-full"
        >
          {isValidating ? 'Connecting...' : 'Sign in with SimPro'}
        </Button>
      </div>

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          By connecting, you agree to authenticate with your SimPro credentials
        </p>
      </div>
    </div>
  )
}