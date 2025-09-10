import { useState, useCallback, useEffect, useRef } from 'react';
import { validation, ValidationResult } from '../utils/validation';

export interface BaseViewOptions<T> {
  /** Initial data for the view */
  initialData: T;
  /** Callback when data is updated */
  onUpdate?: (updates: Partial<T>) => void;
  /** Validation rules specific to this view */
  validationRules?: (data: T) => ValidationResult;
  /** Debounce delay for updates in milliseconds */
  updateDebounceMs?: number;
  /** Enable console logging for debugging */
  enableLogging?: boolean;
  /** Auto-validate on changes */
  validateOnChange?: boolean;
  /** Track if user has manually edited fields */
  trackUserEdits?: boolean;
}

export interface BaseViewState<T> {
  /** Current local state data */
  localData: T;
  /** Validation errors */
  errors: Record<string, string>;
  /** Validation warnings */
  warnings: Record<string, string>;
  /** Whether the view has unsaved changes */
  isDirty: boolean;
  /** Whether the view is currently valid */
  isValid: boolean;
  /** Whether data is being saved/updated */
  isUpdating: boolean;
  /** Fields that have been manually edited by user */
  editedFields: Set<string>;
}

export interface BaseViewActions<T> {
  /** Update a specific field */
  updateField: (fieldName: keyof T, value: any) => void;
  /** Update multiple fields at once */
  updateFields: (updates: Partial<T>) => void;
  /** Save changes (calls onUpdate) */
  saveChanges: () => Promise<void>;
  /** Discard changes and revert to initial data */
  discardChanges: () => void;
  /** Manually validate the current data */
  validate: () => boolean;
  /** Clear all validation errors and warnings */
  clearValidation: () => void;
  /** Reset the view to initial state */
  reset: () => void;
  /** Mark field as edited */
  markFieldAsEdited: (fieldName: keyof T) => void;
}

/**
 * Base hook for view components that provides common functionality:
 * - Local state management
 * - Validation
 * - Dirty state tracking
 * - Debounced updates
 * - Error handling
 * - User edit tracking
 */
export function useBaseView<T extends Record<string, any>>(
  options: BaseViewOptions<T>
): [BaseViewState<T>, BaseViewActions<T>] {
  const {
    initialData,
    onUpdate,
    validationRules,
    updateDebounceMs = 0,
    enableLogging = false,
    validateOnChange = true,
    trackUserEdits = true
  } = options;

  // State
  const [localData, setLocalData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  // Refs
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataRef = useRef<T>(initialData);
  const isInitializedRef = useRef<boolean>(false);

  // Update initial data ref when prop changes
  useEffect(() => {
    initialDataRef.current = initialData;
    
    // If not initialized or if user hasn't edited anything, update local data
    if (!isInitializedRef.current || editedFields.size === 0) {
      setLocalData(initialData);
      setIsDirty(false);
      
      if (enableLogging) {
        console.log('[BaseView] Updated local data from props:', initialData);
      }
    }
    
    isInitializedRef.current = true;
  }, [initialData, editedFields.size, enableLogging]);

  // Validation function
  const performValidation = useCallback((data: T): boolean => {
    if (!validationRules) {
      setErrors({});
      setWarnings({});
      setIsValid(true);
      return true;
    }

    const validationResult = validationRules(data);
    
    // Process errors
    const errorMap: Record<string, string> = {};
    validationResult.errors.forEach(error => {
      if (error.field) {
        errorMap[error.field] = error.message;
      }
    });

    // Process warnings
    const warningMap: Record<string, string> = {};
    if (validationResult.warnings) {
      validationResult.warnings.forEach(warning => {
        if (warning.field) {
          warningMap[warning.field] = warning.message;
        }
      });
    }

    setErrors(errorMap);
    setWarnings(warningMap);
    setIsValid(validationResult.isValid);

    if (enableLogging) {
      console.log('[BaseView] Validation result:', {
        isValid: validationResult.isValid,
        errors: errorMap,
        warnings: warningMap
      });
    }

    return validationResult.isValid;
  }, [validationRules, enableLogging]);

  // Check if data has changed from initial
  const checkIsDirty = useCallback((data: T): boolean => {
    const isDirtyValue = JSON.stringify(data) !== JSON.stringify(initialDataRef.current);
    setIsDirty(isDirtyValue);
    return isDirtyValue;
  }, []);

  // Debounced update function
  const debouncedUpdate = useCallback((data: T) => {
    if (!onUpdate) return;

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Set new timeout if debouncing is enabled
    if (updateDebounceMs > 0) {
      updateTimeoutRef.current = setTimeout(() => {
        if (enableLogging) {
          console.log('[BaseView] Calling debounced update:', data);
        }
        onUpdate(data);
      }, updateDebounceMs);
    } else {
      if (enableLogging) {
        console.log('[BaseView] Calling immediate update:', data);
      }
      onUpdate(data);
    }
  }, [onUpdate, updateDebounceMs, enableLogging]);

  // Update field function
  const updateField = useCallback((fieldName: keyof T, value: any) => {
    setLocalData(prevData => {
      const newData = { ...prevData, [fieldName]: value };
      
      // Validate if enabled
      if (validateOnChange) {
        performValidation(newData);
      }
      
      // Check dirty state
      checkIsDirty(newData);
      
      // Track user edit
      if (trackUserEdits) {
        setEditedFields(prev => new Set(prev).add(fieldName as string));
      }
      
      // Trigger update callback
      debouncedUpdate(newData);
      
      if (enableLogging) {
        console.log(`[BaseView] Updated field ${String(fieldName)}:`, value);
      }
      
      return newData;
    });
  }, [validateOnChange, performValidation, checkIsDirty, trackUserEdits, debouncedUpdate, enableLogging]);

  // Update multiple fields function
  const updateFields = useCallback((updates: Partial<T>) => {
    setLocalData(prevData => {
      const newData = { ...prevData, ...updates };
      
      // Validate if enabled
      if (validateOnChange) {
        performValidation(newData);
      }
      
      // Check dirty state
      checkIsDirty(newData);
      
      // Track user edits
      if (trackUserEdits) {
        const newEditedFields = new Set(editedFields);
        Object.keys(updates).forEach(key => newEditedFields.add(key));
        setEditedFields(newEditedFields);
      }
      
      // Trigger update callback
      debouncedUpdate(newData);
      
      if (enableLogging) {
        console.log('[BaseView] Updated multiple fields:', updates);
      }
      
      return newData;
    });
  }, [validateOnChange, performValidation, checkIsDirty, trackUserEdits, editedFields, debouncedUpdate, enableLogging]);

  // Save changes function
  const saveChanges = useCallback(async (): Promise<void> => {
    if (!onUpdate) {
      if (enableLogging) {
        console.warn('[BaseView] No onUpdate callback provided');
      }
      return;
    }

    setIsUpdating(true);
    
    try {
      // Validate before saving
      const isValidData = performValidation(localData);
      
      if (!isValidData) {
        throw new Error('Validation failed. Please fix errors before saving.');
      }

      // Clear any pending debounced update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }

      // Call update
      await onUpdate(localData);
      
      // Update initial data reference and reset dirty state
      initialDataRef.current = localData;
      setIsDirty(false);
      
      if (enableLogging) {
        console.log('[BaseView] Changes saved successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save changes';
      
      // Add save error to errors
      setErrors(prev => ({ ...prev, _save: errorMessage }));
      
      if (enableLogging) {
        console.error('[BaseView] Save failed:', error);
      }
      
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [onUpdate, localData, performValidation, enableLogging]);

  // Discard changes function
  const discardChanges = useCallback(() => {
    setLocalData(initialDataRef.current);
    setIsDirty(false);
    setErrors({});
    setWarnings({});
    setEditedFields(new Set());
    
    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
    
    if (enableLogging) {
      console.log('[BaseView] Changes discarded, reverted to:', initialDataRef.current);
    }
  }, [enableLogging]);

  // Validate function
  const validate = useCallback((): boolean => {
    return performValidation(localData);
  }, [performValidation, localData]);

  // Clear validation function
  const clearValidation = useCallback(() => {
    setErrors({});
    setWarnings({});
    setIsValid(true);
    
    if (enableLogging) {
      console.log('[BaseView] Validation cleared');
    }
  }, [enableLogging]);

  // Reset function
  const reset = useCallback(() => {
    setLocalData(initialDataRef.current);
    setErrors({});
    setWarnings({});
    setIsDirty(false);
    setIsValid(true);
    setEditedFields(new Set());
    
    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
    
    if (enableLogging) {
      console.log('[BaseView] View reset to initial state');
    }
  }, [enableLogging]);

  // Mark field as edited function
  const markFieldAsEdited = useCallback((fieldName: keyof T) => {
    if (trackUserEdits) {
      setEditedFields(prev => new Set(prev).add(fieldName as string));
      
      if (enableLogging) {
        console.log(`[BaseView] Marked field as edited: ${String(fieldName)}`);
      }
    }
  }, [trackUserEdits, enableLogging]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Initial validation
  useEffect(() => {
    if (isInitializedRef.current && validateOnChange) {
      performValidation(localData);
    }
  }, [localData, validateOnChange, performValidation]);

  const state: BaseViewState<T> = {
    localData,
    errors,
    warnings,
    isDirty,
    isValid,
    isUpdating,
    editedFields
  };

  const actions: BaseViewActions<T> = {
    updateField,
    updateFields,
    saveChanges,
    discardChanges,
    validate,
    clearValidation,
    reset,
    markFieldAsEdited
  };

  return [state, actions];
}

/**
 * Specialized hook for node-based views (service details, group details, etc.)
 */
export function useNodeView<T extends { id: string; label: string; type: string }>(
  initialNode: T,
  onUpdateNode?: (nodeId: string, updates: Partial<T>) => void,
  options: Omit<BaseViewOptions<T>, 'onUpdate'> = {}
) {
  const baseOptions: BaseViewOptions<T> = {
    ...options,
    initialData: initialNode,
    onUpdate: onUpdateNode ? (updates) => onUpdateNode(initialNode.id, updates) : undefined
  };

  return useBaseView(baseOptions);
}

/**
 * Hook for form field validation specific to form editor
 */
export function useFormFieldValidation() {
  const validateFieldName = useCallback((name: string, existingNames: string[] = []): string | null => {
    if (!name || name.trim() === '') {
      return 'Field name is required';
    }

    const trimmedName = name.trim();
    
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmedName)) {
      return 'Field name must start with a letter and contain only letters, numbers, underscores, and hyphens';
    }

    if (existingNames.includes(trimmedName)) {
      return 'Field name already exists';
    }

    if (trimmedName.length > 50) {
      return 'Field name cannot be longer than 50 characters';
    }

    return null;
  }, []);

  const validateFieldLabel = useCallback((label: string): string | null => {
    if (!label || label.trim() === '') {
      return 'Field label is required';
    }

    if (label.trim().length > 100) {
      return 'Field label cannot be longer than 100 characters';
    }

    return null;
  }, []);

  return {
    validateFieldName,
    validateFieldLabel
  };
}