import { useState, useEffect, useCallback, useRef } from 'react';
import { useFormStore } from '../stores/form-store';
import { ValidationError, eventBus } from '../core/events/event-bus';
import { FormState, Node } from '../core/models/types';

export interface ValidationRule {
  field: string;
  validator: (value: any, formState: FormState) => Promise<string | null> | string | null;
  severity: 'error' | 'warning';
}

const defaultValidationRules: ValidationRule[] = [
  {
    field: 'name',
    validator: (value) => !value ? 'Form name is required' : null,
    severity: 'error'
  },
  {
    field: 'slug',
    validator: (value) => {
      if (!value) return 'URL slug is required';
      if (!/^[a-z0-9-]+$/.test(value)) return 'Slug can only contain lowercase letters, numbers, and hyphens';
      return null;
    },
    severity: 'error'
  },
  {
    field: 'services',
    validator: (_, formState) => {
      const serviceCount = Object.values(formState.nodes).filter(node => node.type === 'service').length;
      if (serviceCount === 0) return 'At least one service is required';
      return null;
    },
    severity: 'warning'
  }
];

export function useValidation(customRules: ValidationRule[] = []) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | undefined>();
  
  const rules = [...defaultValidationRules, ...customRules];

  // Initialize web worker for validation if available
  useEffect(() => {
    // Check if we're in a browser environment and if Worker is supported
    if (typeof window !== 'undefined' && window.Worker) {
      try {
        // For now, we'll do validation in main thread
        // In production, you'd want to move this to a web worker
        // workerRef.current = new Worker('/workers/validation.worker.js');
      } catch (error) {
        console.warn('Web Worker not available, using main thread validation');
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Validate a single field
  const validateField = useCallback(async (
    field: string, 
    value: any, 
    formState: FormState
  ): Promise<ValidationError[]> => {
    const fieldRules = rules.filter(rule => rule.field === field);
    const fieldErrors: ValidationError[] = [];

    for (const rule of fieldRules) {
      try {
        const result = await rule.validator(value, formState);
        if (result) {
          fieldErrors.push({
            field,
            message: result,
            severity: rule.severity
          });
        }
      } catch (error) {
        console.error(`Validation error for field ${field}:`, error);
        fieldErrors.push({
          field,
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        });
      }
    }

    return fieldErrors;
  }, [rules]);

  // Validate entire form
  const validateForm = useCallback(async (formState: FormState): Promise<ValidationError[]> => {
    const allErrors: ValidationError[] = [];
    
    // Validate basic form fields
    const basicErrors = await Promise.all([
      validateField('name', formState.name, formState),
      validateField('slug', formState.slug, formState),
      validateField('services', null, formState)
    ]);
    
    allErrors.push(...basicErrors.flat());

    // Validate nodes
    for (const [nodeId, node] of Object.entries(formState.nodes)) {
      const nodeErrors = await validateNode(node, formState);
      allErrors.push(...nodeErrors);
    }

    // Validate questions
    for (const [questionId, question] of Object.entries(formState.questions)) {
      const questionErrors = await validateQuestion(question, formState);
      allErrors.push(...questionErrors);
    }

    return allErrors;
  }, [validateField]);

  // Validate a specific node
  const validateNode = useCallback(async (
    node: Node,
    formState: FormState
  ): Promise<ValidationError[]> => {
    const errors: ValidationError[] = [];

    switch (node.type) {
      case 'root':
        if (!node.title?.trim()) {
          errors.push({
            field: `node.${node.id}.title`,
            message: 'Root title cannot be empty',
            severity: 'error'
          });
        }
        break;
        
      case 'service':
        if (!node.label?.trim()) {
          errors.push({
            field: `node.${node.id}.label`,
            message: 'Service name is required',
            severity: 'error'
          });
        }
        
        if (node.duration !== undefined && node.duration <= 0) {
          errors.push({
            field: `node.${node.id}.duration`,
            message: 'Service duration must be greater than 0',
            severity: 'error'
          });
        }
        
        if (node.price !== undefined && node.price < 0) {
          errors.push({
            field: `node.${node.id}.price`,
            message: 'Service price cannot be negative',
            severity: 'error'
          });
        }
        break;
        
      case 'group':
        if (!node.label?.trim()) {
          errors.push({
            field: `node.${node.id}.label`,
            message: 'Group name is required',
            severity: 'error'
          });
        }
        
        if (node.childIds.length === 0) {
          errors.push({
            field: `node.${node.id}.children`,
            message: 'Group should contain at least one child',
            severity: 'warning'
          });
        }
        break;
    }

    return errors;
  }, []);

  // Validate a specific question
  const validateQuestion = useCallback(async (
    question: any,
    formState: FormState
  ): Promise<ValidationError[]> => {
    const errors: ValidationError[] = [];

    if (!question.config?.label?.trim()) {
      errors.push({
        field: `question.${question.id}.label`,
        message: 'Question label is required',
        severity: 'error'
      });
    }

    // Validate service relationship
    const service = formState.nodes[question.serviceId];
    if (!service || service.type !== 'service') {
      errors.push({
        field: `question.${question.id}.service`,
        message: 'Question must be associated with a valid service',
        severity: 'error'
      });
    }

    return errors;
  }, []);

  // Debounced validation
  const debouncedValidation = useCallback(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    validationTimeoutRef.current = setTimeout(async () => {
      const formState = useFormStore.getState();
      
      setIsValidating(true);
      eventBus.emit('validation.started', { formId: formState.id });
      
      try {
        const newErrors = await validateForm(formState);
        setErrors(newErrors);
        
        eventBus.emit('validation.completed', { 
          formId: formState.id, 
          errors: newErrors 
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Validation failed');
        eventBus.emit('validation.failed', { 
          formId: formState.id, 
          error: err.message 
        });
      } finally {
        setIsValidating(false);
      }
    }, 500); // 500ms debounce
  }, [validateForm]);

  // Subscribe to form changes
  useEffect(() => {
    const unsubscribe = useFormStore.subscribe(debouncedValidation);

    // Initial validation
    debouncedValidation();

    return () => {
      unsubscribe();
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [debouncedValidation]);

  // Force validation
  const forceValidation = useCallback(async () => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    
    const formState = useFormStore.getState();
    setIsValidating(true);
    
    try {
      const newErrors = await validateForm(formState);
      setErrors(newErrors);
      return newErrors;
    } finally {
      setIsValidating(false);
    }
  }, [validateForm]);

  // Get errors by severity
  const getErrorsBySeverity = useCallback((severity: 'error' | 'warning') => {
    return errors.filter(error => error.severity === severity);
  }, [errors]);

  // Get errors for a specific field
  const getFieldErrors = useCallback((field: string) => {
    return errors.filter(error => error.field === field);
  }, [errors]);

  // Check if form is valid
  const isValid = errors.filter(error => error.severity === 'error').length === 0;
  const hasWarnings = errors.filter(error => error.severity === 'warning').length > 0;

  return {
    errors,
    isValidating,
    isValid,
    hasWarnings,
    getErrorsBySeverity,
    getFieldErrors,
    validateField,
    validateForm,
    forceValidation
  };
}