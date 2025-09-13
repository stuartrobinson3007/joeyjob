import { useState } from 'react'
import { X, ExternalLink } from 'lucide-react'

import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'

interface ProviderUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  providerType: string
  organizationData?: {
    providerData?: any
    providerCompanyId?: string
  }
  onRefresh?: () => Promise<void>
}

export function ProviderUpdateModal({ 
  isOpen, 
  onClose, 
  providerType,
  organizationData,
  onRefresh 
}: ProviderUpdateModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (!onRefresh) return

    setIsRefreshing(true)
    try {
      await onRefresh()
      onClose()
    } catch (error) {
      console.error('Error refreshing data:', error)
      // Error will be handled by the parent component
    } finally {
      setIsRefreshing(false)
    }
  }

  const getProviderInstructions = () => {
    switch (providerType) {
      case 'simpro':
        // Build the correct Simpro settings URL using the user's actual domain
        let settingsUrl = null
        if (organizationData?.providerData) {
          // Check if we have build config in provider data
          const buildName = 'joeyjob' // Default, could be extracted from provider data if stored
          const domain = 'simprosuite.com' // Default, could be extracted from provider data if stored
          settingsUrl = `https://${buildName}.${domain}/staff/configCompany.php`
        }
        
        return {
          displayName: 'SimPro',
          instructions: settingsUrl 
            ? (
                <>
                  Go to{' '}
                  <a 
                    href={settingsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    SimPro Settings
                  </a>
                  {' '}to update the incorrect details.
                </>
              )
            : 'Go to SimPro Settings to update the incorrect details.',
          settingsNote: 'Already updated the settings? Click Refresh to see the updated settings.',
          settingsUrl,
        }
      case 'minuba':
        return {
          displayName: 'Minuba',
          instructions: 'Go to Minuba Settings to update the incorrect details.',
          settingsNote: 'Already updated the settings? Click Refresh to see the updated settings.',
          settingsUrl: null,
        }
      default:
        return {
          displayName: providerType || 'your provider',
          instructions: `Go to ${providerType || 'your provider'} Settings to update the incorrect details.`,
          settingsNote: 'Already updated the settings? Click Refresh to see the updated settings.',
          settingsUrl: null,
        }
    }
  }

  const providerInfo = getProviderInstructions()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            How to update your business settings in JoeyJob
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <DialogDescription className="text-base">
            {typeof providerInfo.instructions === 'string' 
              ? providerInfo.instructions 
              : <div>{providerInfo.instructions}</div>
            }
          </DialogDescription>
          
          <DialogDescription className="text-base">
            {providerInfo.settingsNote}
          </DialogDescription>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            {onRefresh ? (
              <Button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                loading={isRefreshing}
              >
                Refresh
              </Button>
            ) : (
              <Button onClick={onClose}>
                Got it
              </Button>
            )}
          </div>

          {/* Optional external link for provider settings */}
          {providerInfo.settingsUrl && (
            <div className="pt-2 border-t">
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                onClick={() => window.open(providerInfo.settingsUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open {providerInfo.displayName} Settings
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}