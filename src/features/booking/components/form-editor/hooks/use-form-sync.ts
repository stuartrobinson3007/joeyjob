import { useCallback, useEffect, useRef } from 'react';
import { useForm, UseFormReturn, FieldValues } from 'react-hook-form';
import { FormFieldConfig } from '@/features/booking/lib/form-field-types';
import { FlowNode } from '../form-flow-tree';
import { formHelpers } from '../utils/form-helpers';

export interface FormSyncOptions {
  /** Enable console logging for debugging */
  enableLogging?: boolean;
  /** Validate on change */
  validateOnChange?: boolean;
  /** Auto-clear errors after successful updates */
  autoClearErrors?: boolean;
}

export interface FormSyncState {
  isFormValid: boolean;
  formErrors: Record<string, string>;
  isDirty: boolean;
}

export interface FormSyncActions {
  updateQuestionOptions: (questionId: string, oldValue: string, newValue: string) => void;
  resetFormForService: (serviceNode: FlowNode | null, baseQuestions: FormFieldConfig[]) => void;
  syncFormWithQuestions: (questions: FormFieldConfig[]) => void;
  validateForm: () => boolean;
  clearFormErrors: () => void;
}

/**
 * Hook for managing React Hook Form integration with form editor data.
 * Handles bidirectional sync between form state and question configurations.
 */
export function useFormSync(
  baseQuestions: FormFieldConfig[],
  serviceTree: FlowNode,
  selectedServiceId: string | null,
  options: FormSyncOptions = {}
): [UseFormReturn<FieldValues>, FormSyncState, FormSyncActions] {
  const { 
    enableLogging = false, 
    validateOnChange = false,
    autoClearErrors = true 
  } = options;

  const lastSyncHashRef = useRef<string>('');
  const isInitializedRef = useRef<boolean>(false);

  // Get current service node
  const getCurrentServiceNode = useCallback((): FlowNode | null => {
    if (!selectedServiceId) return null;
    
    const findServiceNode = (node: FlowNode): FlowNode | null => {
      if (node.id === selectedServiceId) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findServiceNode(child);
          if (found) return found;
        }
      }
      return null;
    };

    return findServiceNode(serviceTree);
  }, [serviceTree, selectedServiceId]);

  // Get all relevant questions (base + service-specific)
  const getAllQuestions = useCallback((): FormFieldConfig[] => {
    const serviceNode = getCurrentServiceNode();
    const serviceQuestions = serviceNode?.additionalQuestions || [];
    return [...baseQuestions, ...serviceQuestions];
  }, [baseQuestions, getCurrentServiceNode]);

  // Generate default values from questions
  const generateDefaultValues = useCallback((questions: FormFieldConfig[]): FieldValues => {
    const defaults: FieldValues = {
      // Standard contact info structure
      contact_info: {
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      },
      // Standard address structure
      address: {
        street: '',
        street2: '',
        city: '',
        state: '',
        zip: ''
      },
      // Backward compatibility fields
      'contact-info-field': {
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      },
      'address-field': {
        street: '',
        street2: '',
        city: '',
        state: '',
        zip: ''
      }
    };

    // Add defaults for all question fields
    questions.forEach(question => {
      defaults[question.name] = formHelpers.getDefaultValue(question.type);
    });

    if (enableLogging) {
      console.log('📝 [FormSync] Generated default values:', defaults);
    }

    return defaults;
  }, [enableLogging]);

  // Initialize form with default values
  const allQuestions = getAllQuestions();
  const formMethods = useForm({
    defaultValues: generateDefaultValues(allQuestions),
    mode: validateOnChange ? 'onChange' : 'onSubmit'
  });

  // Create hash for change detection
  const createQuestionsHash = useCallback((questions: FormFieldConfig[]): string => {
    try {
      return JSON.stringify(questions.map(q => ({
        id: q.id,
        name: q.name,
        type: q.type,
        options: 'options' in q ? q.options : undefined,
        required: q.required
      })));
    } catch (error) {
      if (enableLogging) {
        console.error('Error creating questions hash:', error);
      }
      return '';
    }
  }, [enableLogging]);

  // Update question options and sync with form
  const updateQuestionOptions = useCallback((questionId: string, oldValue: string, newValue: string) => {
    const questions = getAllQuestions();
    const question = questions.find(q => q.id === questionId);
    
    if (!question) {
      if (enableLogging) {
        console.warn(`[FormSync] Question not found: ${questionId}`);
      }
      return;
    }

    const fieldName = question.name;
    const currentFormValue = formMethods.getValues(fieldName);

    if (enableLogging) {
      console.log(`[FormSync] Updating options for ${fieldName}:`, { oldValue, newValue, currentFormValue });
    }

    // Handle option removal
    if (newValue === '') {
      if (typeof currentFormValue === 'string' && currentFormValue === oldValue) {
        // Reset single-select field if selected option is removed
        formMethods.setValue(fieldName, '', { shouldValidate: validateOnChange });
        if (enableLogging) {
          console.log(`[FormSync] Reset single-select field ${fieldName}`);
        }
      } else if (Array.isArray(currentFormValue) && currentFormValue.includes(oldValue)) {
        // Remove from multi-select field
        const newFormValue = currentFormValue.filter(val => val !== oldValue);
        formMethods.setValue(fieldName, newFormValue, { shouldValidate: validateOnChange });
        if (enableLogging) {
          console.log(`[FormSync] Removed option from multi-select field ${fieldName}:`, newFormValue);
        }
      }
    }
    // Handle option value change
    else if (newValue !== oldValue) {
      if (typeof currentFormValue === 'string' && currentFormValue === oldValue) {
        // Update single-select field
        formMethods.setValue(fieldName, newValue, { shouldValidate: validateOnChange });
        if (enableLogging) {
          console.log(`[FormSync] Updated single-select field ${fieldName} to:`, newValue);
        }
      } else if (Array.isArray(currentFormValue) && currentFormValue.includes(oldValue)) {
        // Update multi-select field
        const newFormValue = currentFormValue.map(val => val === oldValue ? newValue : val);
        formMethods.setValue(fieldName, newFormValue, { shouldValidate: validateOnChange });
        if (enableLogging) {
          console.log(`[FormSync] Updated multi-select field ${fieldName}:`, newFormValue);
        }
      }
    }

    if (autoClearErrors) {
      formMethods.clearErrors(fieldName);
    }
  }, [getAllQuestions, formMethods, validateOnChange, enableLogging, autoClearErrors]);

  // Reset form for service selection changes
  const resetFormForService = useCallback((serviceNode: FlowNode | null, baseQuestions: FormFieldConfig[]) => {
    const oldServiceQuestions = getCurrentServiceNode()?.additionalQuestions || [];
    const newServiceQuestions = serviceNode?.additionalQuestions || [];
    
    if (enableLogging) {
      console.log('[FormSync] Resetting form for service change:', {
        oldService: getCurrentServiceNode()?.label,
        newService: serviceNode?.label,
        oldQuestions: oldServiceQuestions.length,
        newQuestions: newServiceQuestions.length
      });
    }

    // Get current form values
    const currentValues = formMethods.getValues();
    const resetData: FieldValues = { ...currentValues };

    // Clear values for fields that are no longer relevant
    const fieldsToReset = oldServiceQuestions
      .filter(oldQ => !newServiceQuestions.some(newQ => newQ.name === oldQ.name))
      .map(q => q.name);

    fieldsToReset.forEach(fieldName => {
      const fieldType = oldServiceQuestions.find(q => q.name === fieldName)?.type;
      resetData[fieldName] = fieldType ? formHelpers.getDefaultValue(fieldType) : '';
      
      if (enableLogging) {
        console.log(`[FormSync] Reset field: ${fieldName}`);
      }
    });

    // Add default values for new fields
    newServiceQuestions.forEach(question => {
      if (!resetData.hasOwnProperty(question.name)) {
        resetData[question.name] = formHelpers.getDefaultValue(question.type);
        
        if (enableLogging) {
          console.log(`[FormSync] Added default for new field: ${question.name}`);
        }
      }
    });

    // Reset the form with updated data
    formMethods.reset(resetData);
    
    if (autoClearErrors) {
      formMethods.clearErrors();
    }
  }, [getCurrentServiceNode, formMethods, enableLogging, autoClearErrors]);

  // Sync form fields with question configurations
  const syncFormWithQuestions = useCallback((questions: FormFieldConfig[]) => {
    const currentValues = formMethods.getValues();
    const updatedValues: FieldValues = { ...currentValues };
    let hasChanges = false;

    questions.forEach(question => {
      if (!currentValues.hasOwnProperty(question.name)) {
        updatedValues[question.name] = formHelpers.getDefaultValue(question.type);
        hasChanges = true;
        
        if (enableLogging) {
          console.log(`[FormSync] Added default value for new field: ${question.name}`);
        }
      }
    });

    if (hasChanges) {
      formMethods.reset(updatedValues);
    }
  }, [formMethods, enableLogging]);

  // Validate form against question configurations
  const validateForm = useCallback((): boolean => {
    const questions = getAllQuestions();
    const formData = formMethods.getValues();
    const errors = formHelpers.validateAllFields(formData, questions);
    
    // Set React Hook Form errors
    Object.entries(errors).forEach(([fieldName, errorMessage]) => {
      formMethods.setError(fieldName, { message: errorMessage });
    });

    const isValid = Object.keys(errors).length === 0;
    
    if (enableLogging) {
      console.log('[FormSync] Form validation result:', { isValid, errors });
    }

    return isValid;
  }, [getAllQuestions, formMethods, enableLogging]);

  // Clear form errors
  const clearFormErrors = useCallback(() => {
    formMethods.clearErrors();
  }, [formMethods]);

  // Effect to sync form when questions change
  useEffect(() => {
    const questions = getAllQuestions();
    const questionsHash = createQuestionsHash(questions);
    
    // Skip on initial load
    if (!isInitializedRef.current) {
      lastSyncHashRef.current = questionsHash;
      isInitializedRef.current = true;
      return;
    }

    // Sync if questions have changed
    if (questionsHash !== lastSyncHashRef.current) {
      syncFormWithQuestions(questions);
      lastSyncHashRef.current = questionsHash;
      
      if (enableLogging) {
        console.log('[FormSync] Questions changed, syncing form fields');
      }
    }
  }, [getAllQuestions, createQuestionsHash, syncFormWithQuestions, enableLogging]);

  // Calculate form state
  const formState = formMethods.formState;
  const formErrors = formState.errors;
  const formErrorsRecord: Record<string, string> = {};
  
  Object.entries(formErrors).forEach(([key, error]) => {
    if (error?.message) {
      formErrorsRecord[key] = error.message;
    }
  });

  const state: FormSyncState = {
    isFormValid: formState.isValid,
    formErrors: formErrorsRecord,
    isDirty: formState.isDirty
  };

  const actions: FormSyncActions = {
    updateQuestionOptions,
    resetFormForService,
    syncFormWithQuestions,
    validateForm,
    clearFormErrors
  };

  return [formMethods, state, actions];
}

/**
 * Helper hook for handling complex field type changes
 */
export function useFieldTypeSync(
  formMethods: UseFormReturn<FieldValues>,
  onUpdateQuestion: (questionId: string, updates: Partial<FormFieldConfig>) => void,
  options: Pick<FormSyncOptions, 'enableLogging'> = {}
) {
  const { enableLogging = false } = options;

  const handleFieldTypeChange = useCallback((
    questionId: string, 
    question: FormFieldConfig, 
    newType: string
  ) => {
    const fieldName = question.name;
    
    if (enableLogging) {
      console.log(`[FormSync] Changing field type from ${question.type} to ${newType} for field ${fieldName}`);
    }

    // Clear the current form value and register new default
    const newDefaultValue = formHelpers.getDefaultValue(newType as any);
    formMethods.setValue(fieldName, newDefaultValue, { shouldValidate: false });
    
    // Clear any validation errors for this field
    formMethods.clearErrors(fieldName);
    
    // Handle special cases for complex field types
    if (question.type === 'contact-info' || question.type === 'address') {
      // Unregister subfields for complex types
      formMethods.unregister(fieldName);
      
      // Re-register with new default structure
      formMethods.setValue(fieldName, newDefaultValue, { shouldValidate: false });
    }
    
    // Update the question configuration
    const updatedQuestion: Partial<FormFieldConfig> = {
      type: newType as any,
      // Reset configuration that doesn't apply to new type
      ...(newType === 'contact-info' && {
        fieldConfig: {
          requiredFields: ['firstName', 'lastName', 'email']
        }
      }),
      ...(newType === 'address' && {
        fieldConfig: {
          requiredFields: ['street', 'city', 'state', 'zip']
        }
      }),
      // Clear options for non-choice fields
      ...(!formHelpers.fieldTypeHasOptions(newType as any) && {
        options: undefined
      }),
      // Add default options for choice fields
      ...(formHelpers.fieldTypeHasOptions(newType as any) && {
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' }
        ]
      })
    };

    onUpdateQuestion(questionId, updatedQuestion);
    
    if (enableLogging) {
      console.log('[FormSync] Field type change completed:', {
        questionId,
        newType,
        newDefaultValue,
        updatedQuestion
      });
    }
  }, [formMethods, onUpdateQuestion, enableLogging]);

  return { handleFieldTypeChange };
}