import { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

import { parseError, handleErrorAction } from '@/taali/errors/client-handler'
import { isErrorCode } from '@/taali/errors/codes'
import { Button } from '@/ui/button'
import i18n from '@/i18n/config'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(_error: Error, _errorInfo: { componentStack: string }) {
    // Error is captured by the component state for display to user
    // In production, consider sending to an error tracking service
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      const parsed = parseError(this.state.error)

      // Get translated message
      const message = isErrorCode(parsed.code)
        ? i18n.t(`errors:codes.${parsed.code}`, { ...(parsed.context || {}), defaultValue: parsed.message })
        : parsed.message

      const errorTitle = i18n.t('errors:titles.error')
      const tryAgainText = i18n.t('errors:actions.retry')

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-destructive mb-4">{errorTitle}</h2>
            <p className="text-muted-foreground mb-6">{String(message)}</p>

            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-muted-foreground mb-4 font-mono">
                Error Code: {parsed.code}
              </p>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={this.reset}>
                <RefreshCw />
                {tryAgainText}
              </Button>

              {parsed.actions?.map((action, index) => (
                <Button
                  key={index}
                  onClick={() => handleErrorAction(action)}
                  variant={index === 0 ? 'default' : 'outline'}
                >
                  {i18n.t(`errors:actions.${action.action}`)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
