import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { Button } from './button'

import { useTranslation } from '@/i18n/hooks/useTranslation'

export interface ConfirmOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null)

interface ConfirmDialogProviderProps {
  children: React.ReactNode
}

export function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
  const { t } = useTranslation('common')
  const [isOpen, setIsOpen] = React.useState(false)
  const [options, setOptions] = React.useState<ConfirmOptions>({})
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null)

  const confirm = React.useCallback(
    (confirmOptions: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        setOptions(confirmOptions)
        setIsOpen(true)
        resolveRef.current = resolve
      })
    },
    []
  )

  const handleConfirm = () => {
    resolveRef.current?.(true)
    setIsOpen(false)
  }

  const handleCancel = () => {
    resolveRef.current?.(false)
    setIsOpen(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel()
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {options.title || t('confirm.title')}
            </DialogTitle>
            <DialogDescription>
              {options.description || t('confirm.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {options.cancelText || t('actions.cancel')}
            </Button>
            <Button
              variant={options.variant || 'default'}
              onClick={handleConfirm}
            >
              {options.confirmText || t('actions.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = React.useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider')
  }
  return context.confirm
}