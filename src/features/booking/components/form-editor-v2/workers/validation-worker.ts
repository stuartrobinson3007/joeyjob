import { useRef, useCallback, useEffect } from 'react';

// Validation web worker for offloading heavy validation tasks
export interface ValidationWorkerMessage {
  type: 'VALIDATE_FORM' | 'VALIDATE_NODE' | 'VALIDATE_QUESTION';
  payload: any;
  id: string;
}

export interface ValidationWorkerResponse {
  type: 'VALIDATION_RESULT' | 'VALIDATION_ERROR';
  id: string;
  result?: any;
  error?: string;
}

// Create a worker using a blob URL to avoid separate file requirements
export const createValidationWorker = () => {
  const workerScript = `
    // Validation functions
    function validateForm(formData) {
      const errors = [];
      
      // Basic form validation
      if (!formData.name || !formData.name.trim()) {
        errors.push({
          field: 'name',
          message: 'Form name is required',
          severity: 'error'
        });
      }
      
      if (!formData.slug || !formData.slug.trim()) {
        errors.push({
          field: 'slug',
          message: 'URL slug is required',
          severity: 'error'
        });
      } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        errors.push({
          field: 'slug',
          message: 'Slug can only contain lowercase letters, numbers, and hyphens',
          severity: 'error'
        });
      }
      
      // Validate nodes
      Object.values(formData.nodes || {}).forEach(node => {
        if (node.type === 'service') {
          if (!node.label || !node.label.trim()) {
            errors.push({
              field: 'node.' + node.id + '.label',
              message: 'Service name is required',
              severity: 'error'
            });
          }
          
          if (node.duration !== undefined && node.duration <= 0) {
            errors.push({
              field: 'node.' + node.id + '.duration',
              message: 'Service duration must be greater than 0',
              severity: 'error'
            });
          }
          
          if (node.price !== undefined && node.price < 0) {
            errors.push({
              field: 'node.' + node.id + '.price',
              message: 'Service price cannot be negative',
              severity: 'error'
            });
          }
        } else if (node.type === 'group') {
          if (!node.label || !node.label.trim()) {
            errors.push({
              field: 'node.' + node.id + '.label',
              message: 'Group name is required',
              severity: 'error'
            });
          }
          
          if (node.childIds && node.childIds.length === 0) {
            errors.push({
              field: 'node.' + node.id + '.children',
              message: 'Group should contain at least one child',
              severity: 'warning'
            });
          }
        }
      });
      
      // Check for at least one service
      const serviceCount = Object.values(formData.nodes || {})
        .filter(node => node.type === 'service').length;
      
      if (serviceCount === 0) {
        errors.push({
          field: 'services',
          message: 'At least one service is required',
          severity: 'warning'
        });
      }
      
      return errors;
    }
    
    function validateNode(node) {
      const errors = [];
      
      switch (node.type) {
        case 'root':
          if (!node.title || !node.title.trim()) {
            errors.push({
              field: 'node.' + node.id + '.title',
              message: 'Root title cannot be empty',
              severity: 'error'
            });
          }
          break;
          
        case 'service':
          if (!node.label || !node.label.trim()) {
            errors.push({
              field: 'node.' + node.id + '.label',
              message: 'Service name is required',
              severity: 'error'
            });
          }
          break;
          
        case 'group':
          if (!node.label || !node.label.trim()) {
            errors.push({
              field: 'node.' + node.id + '.label',
              message: 'Group name is required',
              severity: 'error'
            });
          }
          break;
      }
      
      return errors;
    }
    
    function validateQuestion(question) {
      const errors = [];
      
      if (!question.config || !question.config.label || !question.config.label.trim()) {
        errors.push({
          field: 'question.' + question.id + '.label',
          message: 'Question label is required',
          severity: 'error'
        });
      }
      
      return errors;
    }
    
    // Worker message handler
    self.addEventListener('message', function(e) {
      const { type, payload, id } = e.data;
      
      try {
        let result;
        
        switch (type) {
          case 'VALIDATE_FORM':
            result = validateForm(payload);
            break;
          case 'VALIDATE_NODE':
            result = validateNode(payload);
            break;
          case 'VALIDATE_QUESTION':
            result = validateQuestion(payload);
            break;
          default:
            throw new Error('Unknown validation type: ' + type);
        }
        
        self.postMessage({
          type: 'VALIDATION_RESULT',
          id,
          result
        });
      } catch (error) {
        self.postMessage({
          type: 'VALIDATION_ERROR',
          id,
          error: error.message
        });
      }
    });
  `;
  
  const blob = new Blob([workerScript], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

// Hook for using the validation worker
export function useValidationWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingValidationsRef = useRef<Map<string, (result: any) => void>>(new Map());
  
  useEffect(() => {
    // Create worker on mount
    workerRef.current = createValidationWorker();
    
    // Handle worker messages
    workerRef.current.onmessage = (e) => {
      const { type, id, result, error }: ValidationWorkerResponse = e.data;
      
      const resolver = pendingValidationsRef.current.get(id);
      if (resolver) {
        pendingValidationsRef.current.delete(id);
        
        if (type === 'VALIDATION_RESULT') {
          resolver(result);
        } else {
          resolver({ error });
        }
      }
    };
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);
  
  const validateInWorker = useCallback((type: string, payload: any): Promise<any> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        // Fallback to main thread if worker not available
        resolve([]);
        return;
      }
      
      const id = 'validation-' + Date.now() + '-' + Math.random();
      pendingValidationsRef.current.set(id, resolve);
      
      workerRef.current.postMessage({
        type,
        payload,
        id
      } as ValidationWorkerMessage);
    });
  }, []);
  
  return {
    validateForm: (formData: any) => validateInWorker('VALIDATE_FORM', formData),
    validateNode: (node: any) => validateInWorker('VALIDATE_NODE', node),
    validateQuestion: (question: any) => validateInWorker('VALIDATE_QUESTION', question)
  };
}