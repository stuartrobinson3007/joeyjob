/**
 * Form Editor V2 - Refactored with Zustand, Command Pattern, and Performance Optimizations
 * 
 * This is the main entry point for the new form editor that implements:
 * - Normalized state management with Zustand
 * - Command pattern with undo/redo
 * - Event-driven architecture
 * - Optimistic updates and autosave
 * - Performance optimizations with virtual scrolling and memoization
 * - Real-time validation with web workers
 */

import React, { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription } from '@/taali/components/ui/alert';
import { Button } from '@/taali/components/ui/button';

import { FormState } from './core/models/types';

import { FormEditor } from './FormEditor';
import { withTreePerformance } from './ui/components/MemoizedTreeView';
import { usePerformance } from './hooks/use-performance';
import { useValidationWorker } from './workers/validation-worker';
import { eventBus, useEventSubscription } from './core/events/event-bus';

// Enhanced FormEditor with performance monitoring
const PerformantFormEditor = withTreePerformance(FormEditor);

interface FormEditorV2Props {
  formId: string;
  initialData?: FormState;
  onSave?: (data: any) => Promise<void>;
  onServerSync?: (data: FormState) => Promise<void>;
  
  // Configuration options
  config?: {
    enableAutosave?: boolean;
    enableOptimisticUpdates?: boolean;
    enableVirtualScrolling?: boolean;
    enableWebWorkerValidation?: boolean;
    enablePerformanceMonitoring?: boolean;
    
    // Performance thresholds
    performanceThresholds?: {
      renderTime?: number;
      updateTime?: number;
      validationTime?: number;
      saveTime?: number;
      memoryUsage?: number;
    };
    
    // Autosave settings
    autosaveSettings?: {
      debounceMs?: number;
      maxRetries?: number;
      retryDelayMs?: number;
    };
  };
  
  // Event handlers
  onError?: (error: Error, context?: any) => void;
  onPerformanceWarning?: (metric: string, value: number, threshold: number) => void;
}

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <Alert className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="mt-2">
          <div className="font-medium mb-2">Something went wrong</div>
          <div className="text-sm text-gray-600 mb-3">
            {error.message || 'An unexpected error occurred'}
          </div>
          <Button 
            onClick={resetErrorBoundary} 
            size="sm" 
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Loading component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Loading form editor...</p>
      </div>
    </div>
  );
}

export function FormEditorV2({
  formId,
  initialData,
  onSave,
  onServerSync,
  config = {},
  onError,
  onPerformanceWarning
}: FormEditorV2Props) {
  const {
    enableAutosave = true,
    enableOptimisticUpdates = true,
    enablePerformanceMonitoring = true,
    performanceThresholds
  } = config;

  // Initialize performance monitoring
  const { logMetrics } = usePerformance(performanceThresholds);
  
  // Initialize web worker validation (but don't use the result to avoid unused warning)
  useValidationWorker();

  // Global error handling
  useEventSubscription('error.occurred', ({ source, error, context }) => {
    if (onError) {
      onError(error, { source, context });
    }
  });

  // Performance warning handling
  useEventSubscription('error.occurred', ({ context }) => {
    if (context?.type === 'performance' && onPerformanceWarning) {
      onPerformanceWarning(context.label, context.duration, context.threshold);
    }
  });

  // Development performance logging
  React.useEffect(() => {
    if (enablePerformanceMonitoring && process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        logMetrics();
      }, 30000); // Log every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [enablePerformanceMonitoring, logMetrics]);

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        // Emit error event
        eventBus.emit('error.occurred', {
          source: 'form-editor',
          error,
          context: { errorInfo, formId }
        });
        
        if (onError) {
          onError(error, { errorInfo, formId });
        }
      }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <PerformantFormEditor
          formId={formId}
          initialData={initialData}
          onSave={onSave}
          onServerSync={onServerSync}
          enableAutosave={enableAutosave}
          enableOptimisticUpdates={enableOptimisticUpdates}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

// Convenience exports for easier migration from V1
export { FormEditor } from './FormEditor';
export { useFormStore } from './stores/form-store';
export { useUIStore } from './stores/ui-store';
export { useCommandStore } from './stores/command-store';
export { useCommands } from './hooks/use-commands';
export { useAutosave } from './hooks/use-autosave';
export { useValidation } from './hooks/use-validation';
export { usePerformance } from './hooks/use-performance';
export { eventBus } from './core/events/event-bus';

// Type exports
export type * from './core/models/types';
export type { ValidationError } from './core/events/event-bus';

// Default export
export default FormEditorV2;