import { cn } from '@/components/taali-ui/lib/utils'

interface LoadingOverlayProps {
  className?: string
  variant?: 'table-row' | 'card' | 'full'
}

/**
 * Pulsing transparency overlay for loading states
 * Used on table rows, cards, and other components during async operations
 */
export function LoadingOverlay({ className, variant = 'table-row' }: LoadingOverlayProps) {
  const baseClasses = 'absolute inset-0 bg-background/50 animate-pulse pointer-events-none z-10'
  
  const variantClasses = {
    'table-row': 'rounded-md',
    'card': 'rounded-lg',
    'full': ''
  }

  return (
    <div 
      className={cn(
        baseClasses,
        variantClasses[variant],
        className
      )}
      aria-hidden="true"
    />
  )
}