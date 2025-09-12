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
  onRefresh?: () => Promise<void>
}

export function ProviderUpdateModal({ 
  isOpen, 
  onClose, 
  providerType, 
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
        return {
          displayName: 'SimPro',
          instructions: 'Go to SimPro Settings to update the incorrect details.',
          settingsNote: 'Already updated the settings? Click Refresh to see the updated settings.',
          settingsUrl: null, // Could add specific URL if known
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
            {providerInfo.instructions}
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