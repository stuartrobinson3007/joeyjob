import { useEffect, useRef, useCallback } from 'react';
import { useFormStore } from '../stores/form-store';
import { eventBus } from '../core/events/event-bus';

export interface AutosaveOptions {
  enabled?: boolean;
  debounceMs?: number;
  onSave?: (data: any) => Promise<void>;
  onError?: (error: Error) => void;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface AutosaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
  retryCount: number;
}

export function useAutosave({
  enabled = true,
  debounceMs = 2000,
  onSave,
  onError,
  maxRetries = 3,
  retryDelayMs = 1000
}: AutosaveOptions = {}) {
  const { isDirty, markSaved, id: formId } = useFormStore(state => ({
    isDirty: state.isDirty,
    markSaved: state.markSaved,
    id: state.id
  }));
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>();
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>();
  const stateRef = useRef<AutosaveState>({
    isSaving: false,
    lastSaved: null,
    error: null,
    retryCount: 0
  });

  const performSave = useCallback(async () => {
    if (!onSave || !isDirty || stateRef.current.isSaving) return;

    const formState = useFormStore.getState();
    
    stateRef.current.isSaving = true;
    stateRef.current.error = null;
    
    eventBus.emit('form.save.started', { formId });

    try {
      // Save the form state directly in new format
      await onSave(formState);

      markSaved();
      stateRef.current.lastSaved = new Date();
      stateRef.current.retryCount = 0;
      
      eventBus.emit('form.saved', { 
        formId, 
        timestamp: stateRef.current.lastSaved 
      });
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Save failed');
      stateRef.current.error = err;
      
      eventBus.emit('form.save.failed', { 
        formId, 
        error: err.message 
      });
      
      if (onError) {
        onError(err);
      }
      
      // Retry logic
      if (stateRef.current.retryCount < maxRetries) {
        stateRef.current.retryCount++;
        
        const delay = retryDelayMs * Math.pow(2, stateRef.current.retryCount - 1);
        
        retryTimeoutRef.current = setTimeout(() => {
          performSave();
        }, delay);
        
      }
    } finally {
      stateRef.current.isSaving = false;
    }
  }, [onSave, isDirty, markSaved, formId, onError, maxRetries, retryDelayMs]);

  const debouncedSave = useCallback(() => {
    if (!enabled || !onSave) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout
    saveTimeoutRef.current = setTimeout(performSave, debounceMs);
  }, [enabled, onSave, debounceMs, performSave]);

  // Subscribe to form state changes
  useEffect(() => {
    if (!enabled || !onSave) return;

    // Subscribe to isDirty changes
    const unsubscribe = useFormStore.subscribe((state, prevState) => {
      if (state.isDirty && !prevState.isDirty) {
        debouncedSave();
      }
    });

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [enabled, onSave, debouncedSave]);

  // Force save function
  const forceSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    await performSave();
  }, [performSave]);

  return {
    isSaving: stateRef.current.isSaving,
    lastSaved: stateRef.current.lastSaved,
    error: stateRef.current.error,
    retryCount: stateRef.current.retryCount,
    forceSave
  };
}