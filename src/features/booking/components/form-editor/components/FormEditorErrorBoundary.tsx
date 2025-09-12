import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Alert, AlertDescription } from '@/ui/alert';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { FormEditorError, globalErrorHandler, handleReactError } from '../utils/error-handling';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: FormEditorError) => void;
  showErrorDetails?: boolean;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  formEditorError: FormEditorError | null;
  showDetails: boolean;
}

/**
 * Error boundary component specifically designed for the form editor.
 * Catches JavaScript errors and converts them to FormEditorErrors.
 */
export class FormEditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      formEditorError: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Convert to FormEditorError
    const formEditorError = handleReactError(error, errorInfo, this.props.context);
    
    this.setState({
      errorInfo,
      formEditorError
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(formEditorError);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      formEditorError: null,
      showDetails: false
    });
  };

  toggleDetails = () => {
    this.setState(prev => ({
      showDetails: !prev.showDetails
    }));
  };

  render() {
    if (this.state.hasError) {
      // If custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {this.state.formEditorError?.message || 
                   this.state.error?.message || 
                   'An unexpected error occurred in the form editor.'}
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-2">
                <Button 
                  onClick={this.handleRetry}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>

                {(this.props.showErrorDetails || process.env.NODE_ENV === 'development') && (
                  <Button
                    onClick={this.toggleDetails}
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {this.state.showDetails ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show Details
                      </>
                    )}
                  </Button>
                )}
              </div>

              {this.state.showDetails && (
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Error Details:</h4>
                    <div className="text-xs font-mono space-y-2">
                      {this.state.formEditorError && (
                        <>
                          <div><strong>Code:</strong> {this.state.formEditorError.code}</div>
                          <div><strong>Context:</strong> {this.state.formEditorError.context || 'None'}</div>
                          <div><strong>Timestamp:</strong> {this.state.formEditorError.timestamp.toISOString()}</div>
                          <div><strong>Retryable:</strong> {this.state.formEditorError.retryable ? 'Yes' : 'No'}</div>
                        </>
                      )}
                      {this.state.error && (
                        <>
                          <div><strong>Error Type:</strong> {this.state.error.name}</div>
                          <div><strong>Message:</strong> {this.state.error.message}</div>
                        </>
                      )}
                    </div>
                  </div>

                  {this.state.error?.stack && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Stack Trace:</h4>
                      <pre className="text-xs font-mono bg-background p-2 rounded border overflow-auto max-h-32">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}

                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Component Stack:</h4>
                      <pre className="text-xs font-mono bg-background p-2 rounded border overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p>
                  If this problem persists, please try refreshing the page or contact support.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <p className="mt-2 text-xs">
                    <strong>Development Mode:</strong> Check the console for additional details.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler(context?: string) {
  const handleError = React.useCallback((error: Error | FormEditorError) => {
    if (error instanceof Error) {
      globalErrorHandler.handleJSError(error, context);
    } else {
      globalErrorHandler.addError(error);
    }
  }, [context]);

  const handleAsyncError = React.useCallback(async (
    operation: () => Promise<any>,
    errorMessage?: string,
    retryable: boolean = true
  ) => {
    try {
      return await operation();
    } catch (error) {
      const jsError = error instanceof Error ? error : new Error(String(error));
      const formEditorError = globalErrorHandler.handleJSError(jsError, context, {
        operation: operation.name,
        retryable,
        userMessage: errorMessage
      });
      throw formEditorError;
    }
  }, [context]);

  const clearErrors = React.useCallback((contextToClear?: string) => {
    if (contextToClear) {
      globalErrorHandler.clearErrorsByContext(contextToClear);
    } else if (context) {
      globalErrorHandler.clearErrorsByContext(context);
    } else {
      globalErrorHandler.clearAllErrors();
    }
  }, [context]);

  return {
    handleError,
    handleAsyncError,
    clearErrors,
    errorHandler: globalErrorHandler
  };
}

/**
 * Hook for subscribing to errors
 */
export function useErrors(filterContext?: string) {
  const [errors, setErrors] = React.useState<FormEditorError[]>([]);

  React.useEffect(() => {
    const unsubscribe = globalErrorHandler.subscribe((allErrors) => {
      const filteredErrors = filterContext 
        ? allErrors.filter(error => error.context === filterContext)
        : allErrors;
      setErrors(filteredErrors);
    });

    // Set initial errors
    const initialErrors = filterContext
      ? globalErrorHandler.getErrorsByContext(filterContext)
      : globalErrorHandler.getErrors();
    setErrors(initialErrors);

    return unsubscribe;
  }, [filterContext]);

  const clearError = React.useCallback((errorId: string) => {
    globalErrorHandler.clearError(errorId);
  }, []);

  const clearAllErrors = React.useCallback(() => {
    if (filterContext) {
      globalErrorHandler.clearErrorsByContext(filterContext);
    } else {
      globalErrorHandler.clearAllErrors();
    }
  }, [filterContext]);

  return {
    errors,
    clearError,
    clearAllErrors,
    hasErrors: errors.length > 0,
    errorCount: errors.length,
    errorSummary: {
      errors: errors.filter(e => e.severity === 'error').length,
      warnings: errors.filter(e => e.severity === 'warning').length,
      info: errors.filter(e => e.severity === 'info').length
    }
  };
}

/**
 * Component for displaying error messages
 */
interface ErrorDisplayProps {
  errors: FormEditorError[];
  onClearError?: (errorId: string) => void;
  onClearAll?: () => void;
  showSeverity?: boolean;
  maxErrors?: number;
  className?: string;
}

export function ErrorDisplay({ 
  errors, 
  onClearError, 
  onClearAll, 
  showSeverity = true,
  maxErrors = 10,
  className = ""
}: ErrorDisplayProps) {
  const displayErrors = errors.slice(0, maxErrors);
  const hiddenCount = errors.length - maxErrors;

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {onClearAll && errors.length > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>
          <Button
            onClick={onClearAll}
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            Clear All
          </Button>
        </div>
      )}

      {displayErrors.map(error => (
        <Alert
          key={error.id}
          variant={error.severity === 'error' ? 'destructive' : 'default'}
          className="relative"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="pr-8">
            {showSeverity && (
              <span className="font-medium uppercase text-xs mr-2">
                {error.severity}:
              </span>
            )}
            {error.message}
            {error.context && (
              <span className="text-muted-foreground text-xs ml-2">
                ({error.context})
              </span>
            )}
          </AlertDescription>
          {onClearError && (
            <Button
              onClick={() => onClearError(error.id)}
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0"
            >
              ×
            </Button>
          )}
        </Alert>
      ))}

      {hiddenCount > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          ... and {hiddenCount} more error{hiddenCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}