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
    
    if (!onRefresh) {
      return
    }

    setIsRefreshing(true)
    try {
      await onRefresh()
      onClose()
    } catch (error) {
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
          // Extract build config from provider data
          const providerData = organizationData.providerData as any
          const buildName = providerData?.buildName || 'joeyjob' // Fallback to default
          const domain = providerData?.domain || 'simprosuite.com' // Fallback to default
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
                    className="text-primary hover:text-primary/80 underline"
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
          <DialogTitle>
            How to update your business settings in JoeyJob
          </DialogTitle>
          <DialogDescription className="sr-only">
            Follow the instructions below to update your company information in {providerInfo.displayName}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-base text-muted-foreground">
            {providerInfo.instructions}
          </div>
          
          <div className="text-base text-muted-foreground">
            {providerInfo.settingsNote}
          </div>

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
              <Button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                loading={isRefreshing}
              >
                Refresh
              </Button>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}