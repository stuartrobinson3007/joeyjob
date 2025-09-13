import { useCallback, useEffect, useRef, useState } from 'react';
import { FlowNode } from '../form-flow-tree';
import { FormFieldConfig } from '@/features/booking/lib/form-field-types';

export interface AutosaveData {
  id: string;
  internalName: string;
  slug: string;
  serviceTree: FlowNode;
  baseQuestions: FormFieldConfig[];
  theme: 'light' | 'dark';
  primaryColor: string;
}

export interface AutosaveOptions {
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Maximum number of save retries */
  maxRetries?: number;
  /** Retry delay multiplier (exponential backoff) */
  retryDelayMs?: number;
  /** Enable console logging for debugging */
  enableLogging?: boolean;
  /** Enable autosave functionality */
  enabled?: boolean;
}

export interface AutosaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
  errors: string[];
  retryCount: number;
}

export interface AutosaveActions {
  saveNow: () => Promise<void>;
  resetErrors: () => void;
  markClean: () => void;
  markDirty: () => void;
}

/**
 * Unified autosave hook that replaces the dual autosave systems.
 * Handles both form data and service synchronization in a coordinated way.
 */
export function useUnifiedAutosave(
  data: AutosaveData,
  onSave: (data: AutosaveData) => Promise<void>,
  options: AutosaveOptions = {}
): [AutosaveState, AutosaveActions] {
  const {
    debounceMs = 2000,
    maxRetries = 3,
    retryDelayMs = 1000,
    enableLogging = false,
    enabled = true
  } = options;

  // State
  const [state, setState] = useState<AutosaveState>({
    isSaving: false,
    lastSaved: null,
    isDirty: false,
    errors: [],
    retryCount: 0
  });

  // Refs for tracking
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const isInitializedRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper function to create data hash for comparison
  const createDataHash = useCallback((data: AutosaveData): string => {
    try {
      return JSON.stringify({
        internalName: data.internalName,
        slug: data.slug,
        serviceTree: data.serviceTree,
        baseQuestions: data.baseQuestions,
        theme: data.theme,
        primaryColor: data.primaryColor
      });
    } catch (error) {
      if (enableLogging) {
        console.error('Error creating data hash:', error);
      }
      return '';
    }
  }, [enableLogging]);

  // Check if data has changed
  const hasDataChanged = useCallback((data: AutosaveData): boolean => {
    const currentHash = createDataHash(data);
    return currentHash !== lastSavedDataRef.current && currentHash !== '';
  }, [createDataHash]);

  // Perform the actual save operation
  const performSave = useCallback(async (
    data: AutosaveData,
    isManualSave: boolean = false
  ): Promise<void> => {
    // Cancel any previous save operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState(prev => ({ 
      ...prev, 
      isSaving: true, 
      errors: isManualSave ? [] : prev.errors 
    }));

    if (enableLogging) {
      console.log(`🔄 [Autosave] Starting ${isManualSave ? 'manual' : 'auto'} save...`);
    }

    try {
      await onSave(data);
      
      // If save succeeded, update references and state
      if (!abortController.signal.aborted) {
        const dataHash = createDataHash(data);
        lastSavedDataRef.current = dataHash;
        
        setState(prev => ({
          ...prev,
          isSaving: false,
          lastSaved: new Date(),
          isDirty: false,
          errors: [],
          retryCount: 0
        }));

        if (enableLogging) {
          console.log('✅ [Autosave] Save completed successfully');
        }
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        if (enableLogging) {
          console.log('⏹️ [Autosave] Save operation aborted');
        }
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown save error';
      
      setState(prev => {
        const newRetryCount = prev.retryCount + 1;
        const shouldRetry = !isManualSave && newRetryCount <= maxRetries;
        
        if (enableLogging) {
          console.error(`❌ [Autosave] Save failed (attempt ${newRetryCount}/${maxRetries}):`, errorMessage);
          if (shouldRetry) {
            console.log(`🔄 [Autosave] Will retry in ${retryDelayMs * newRetryCount}ms`);
          }
        }

        return {
          ...prev,
          isSaving: false,
          errors: [...prev.errors.filter(e => e !== errorMessage), errorMessage],
          retryCount: newRetryCount
        };
      });

      // Schedule retry if applicable
      if (state.retryCount < maxRetries && !isManualSave) {
        setTimeout(() => {
          if (!abortController.signal.aborted) {
            performSave(data, false);
          }
        }, retryDelayMs * (state.retryCount + 1));
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [onSave, enableLogging, createDataHash, maxRetries, retryDelayMs, state.retryCount]);

  // Debounced save function
  const debouncedSave = useCallback((data: AutosaveData) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      if (hasDataChanged(data)) {
        performSave(data, false);
      }
    }, debounceMs);
  }, [debounceMs, hasDataChanged, performSave]);

  // Manual save function
  const saveNow = useCallback(async (): Promise<void> => {
    // Skip if disabled or no data
    if (!enabled || !data) {
      if (enableLogging) {
        console.log('⏸️ [Autosave] Save skipped - disabled or no data');
      }
      return;
    }

    // Clear any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    await performSave(data, true);
  }, [enabled, data, performSave, enableLogging]);

  // Other actions
  const resetErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: [] }));
  }, []);

  const markClean = useCallback(() => {
    const dataHash = createDataHash(data);
    lastSavedDataRef.current = dataHash;
    setState(prev => ({ ...prev, isDirty: false }));
  }, [data, createDataHash]);

  const markDirty = useCallback(() => {
    setState(prev => ({ ...prev, isDirty: true }));
  }, []);

  // Effect to handle data changes
  useEffect(() => {
    // Skip all autosave logic if disabled or no data
    if (!enabled || !data) {
      if (enableLogging && !enabled) {
        console.log('⏸️ [Autosave] Disabled, skipping data change detection');
      }
      return;
    }

    const currentHash = createDataHash(data);
    
    // Skip on initial load - don't mark as dirty
    if (!isInitializedRef.current) {
      lastSavedDataRef.current = currentHash;
      isInitializedRef.current = true;
      // Don't set isDirty here - it's already false from initial state
      if (enableLogging) {
        console.log('🔄 [Autosave] Initialized with data, ready for change detection');
      }
      return;
    }

    // Check if data has changed
    if (currentHash !== lastSavedDataRef.current && currentHash !== '') {
      setState(prev => ({ ...prev, isDirty: true }));
      debouncedSave(data);

      if (enableLogging) {
        console.log('📝 [Autosave] Data changed, scheduling save...');
      }
    }

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, data, createDataHash, debouncedSave, enableLogging]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Cancel any in-flight save
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const actions: AutosaveActions = {
    saveNow,
    resetErrors,
    markClean,
    markDirty
  };

  return [state, actions];
}

/**
 * Hook for handling service synchronization specifically.
 * This can be used alongside the main autosave hook for complex scenarios.
 */
export function useServiceSync(
  serviceTree: FlowNode,
  onSync: (services: any[]) => Promise<void>,
  options: Pick<AutosaveOptions, 'debounceMs' | 'enableLogging'> = {}
) {
  const { debounceMs = 3000, enableLogging = false } = options;
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedRef = useRef<string>('');
  const isInitializedRef = useRef<boolean>(false);

  // Extract services from tree
  const extractServices = useCallback((node: FlowNode): any[] => {
    const services: any[] = [];
    
    if (node.type === 'service') {
      services.push({
        id: node.id,
        label: node.label,
        description: node.description,
        price: node.price,
        isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(node.id)
      });
    }

    if (node.children) {
      for (const child of node.children) {
        services.push(...extractServices(child));
      }
    }

    return services;
  }, []);

  // Sync services
  const syncServices = useCallback(async () => {
    setIsSyncing(true);
    setSyncErrors([]);
    
    try {
      const services = extractServices(serviceTree);
      await onSync(services);
      
      const servicesHash = JSON.stringify(services);
      lastSyncedRef.current = servicesHash;
      
      if (enableLogging) {
        console.log('✅ [ServiceSync] Services synchronized successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Service sync error';
      setSyncErrors([errorMessage]);
      
      if (enableLogging) {
        console.error('❌ [ServiceSync] Sync failed:', errorMessage);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [serviceTree, onSync, extractServices, enableLogging]);

  // Effect to handle service changes
  useEffect(() => {
    const services = extractServices(serviceTree);
    const servicesHash = JSON.stringify(services);
    
    // Skip on initial load
    if (!isInitializedRef.current) {
      lastSyncedRef.current = servicesHash;
      isInitializedRef.current = true;
      return;
    }

    // Check if services changed
    if (servicesHash !== lastSyncedRef.current) {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        syncServices();
      }, debounceMs);

      if (enableLogging) {
        console.log('🔄 [ServiceSync] Services changed, scheduling sync...');
      }
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [serviceTree, extractServices, syncServices, debounceMs, enableLogging]);

  return {
    isSyncing,
    syncErrors,
    syncNow: syncServices
  };
}