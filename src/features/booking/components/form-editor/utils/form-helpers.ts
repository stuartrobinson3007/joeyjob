import { FormFieldConfig, FormFieldType, ContactInfoFieldConfig, AddressFieldConfig, ChoiceFieldConfig } from '@/features/booking/lib/form-field-types';

/**
 * Centralized utilities for form field operations.
 * Eliminates duplicate form handling logic across components.
 */
export const formHelpers = {
  /**
   * Generate a unique field name based on label
   */
  generateFieldName(label: string, existingNames: string[] = []): string {
    const baseSlug = label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    
    let fieldName = baseSlug;
    let counter = 1;
    
    while (existingNames.includes(fieldName)) {
      fieldName = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return fieldName;
  },

  /**
   * Generate a unique field ID
   */
  generateFieldId(prefix: string = 'field'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Get default value for a field type
   */
  getDefaultValue(fieldType: FormFieldType): any {
    switch (fieldType) {
      case 'contact-info':
        return {
          firstName: '',
          lastName: '',
          email: '',
          phone: ''
        };
      case 'address':
        return {
          street: '',
          street2: '',
          city: '',
          state: '',
          zip: ''
        };
      case 'multiple-choice':
      case 'checkbox-list':
        return [];
      case 'yes-no':
        return false;
      case 'dropdown':
      case 'radio':
      case 'text':
      case 'textarea':
      case 'number':
      default:
        return '';
    }
  },

  /**
   * Get all field names from question configs
   */
  getFieldNames(questions: FormFieldConfig[]): string[] {
    return questions.map(q => q.name);
  },

  /**
   * Find a question by ID in a list of questions
   */
  findQuestionById(questions: FormFieldConfig[], id: string): FormFieldConfig | null {
    return questions.find(q => q.id === id) || null;
  },

  /**
   * Check if a field type has options (dropdown, radio, etc.)
   */
  fieldTypeHasOptions(fieldType: FormFieldType): boolean {
    return ['dropdown', 'radio', 'multiple-choice', 'checkbox-list'].includes(fieldType);
  },

  /**
   * Get options from a field config if it has them
   */
  getFieldOptions(field: FormFieldConfig): Array<{value: string, label: string}> {
    if ('options' in field && Array.isArray(field.options)) {
      return field.options;
    }
    return [];
  },

  /**
   * Update options for a field that supports them
   */
  updateFieldOptions(
    field: FormFieldConfig, 
    oldValue: string, 
    newValue: string
  ): FormFieldConfig {
    if (!this.fieldTypeHasOptions(field.type)) {
      return field;
    }

    const choiceField = field as ChoiceFieldConfig;
    let updatedOptions = [...(choiceField.options || [])];

    if (newValue === '') {
      // Remove option
      updatedOptions = updatedOptions.filter(opt => opt.value !== oldValue);
    } else {
      // Update option
      updatedOptions = updatedOptions.map(opt =>
        opt.value === oldValue ? { value: newValue, label: newValue } : opt
      );
    }

    return {
      ...field,
      options: updatedOptions
    } as FormFieldConfig;
  },

  /**
   * Add a new option to a field that supports options
   */
  addFieldOption(field: FormFieldConfig, option: {value: string, label: string}): FormFieldConfig {
    if (!this.fieldTypeHasOptions(field.type)) {
      return field;
    }

    const choiceField = field as ChoiceFieldConfig;
    const updatedOptions = [...(choiceField.options || []), option];

    return {
      ...field,
      options: updatedOptions
    } as FormFieldConfig;
  },

  /**
   * Remove an option from a field
   */
  removeFieldOption(field: FormFieldConfig, optionValue: string): FormFieldConfig {
    if (!this.fieldTypeHasOptions(field.type)) {
      return field;
    }

    const choiceField = field as ChoiceFieldConfig;
    const updatedOptions = (choiceField.options || []).filter(opt => opt.value !== optionValue);

    return {
      ...field,
      options: updatedOptions
    } as FormFieldConfig;
  },

  /**
   * Check if a field is required
   */
  isFieldRequired(field: FormFieldConfig): boolean {
    return field.required || false;
  },

  /**
   * Check if a specific subfield is required (for contact-info and address fields)
   */
  isSubfieldRequired(field: FormFieldConfig, subfieldId: string): boolean {
    if (field.type === 'contact-info') {
      const contactField = field as ContactInfoFieldConfig;
      return contactField.fieldConfig?.requiredFields?.includes(subfieldId) || false;
    }
    
    if (field.type === 'address') {
      const addressField = field as AddressFieldConfig;
      return addressField.fieldConfig?.requiredFields?.includes(subfieldId) || false;
    }

    return false;
  },

  /**
   * Update subfield requirements
   */
  updateSubfieldRequirement(
    field: FormFieldConfig, 
    subfieldId: string, 
    required: boolean
  ): FormFieldConfig {
    if (field.type === 'contact-info') {
      const contactField = field as ContactInfoFieldConfig;
      const requiredFields = contactField.fieldConfig?.requiredFields || [];
      
      const updatedRequiredFields = required
        ? [...requiredFields.filter(id => id !== subfieldId), subfieldId]
        : requiredFields.filter(id => id !== subfieldId);

      return {
        ...field,
        fieldConfig: {
          ...contactField.fieldConfig,
          requiredFields: updatedRequiredFields
        }
      } as FormFieldConfig;
    }

    if (field.type === 'address') {
      const addressField = field as AddressFieldConfig;
      const requiredFields = addressField.fieldConfig?.requiredFields || [];
      
      const updatedRequiredFields = required
        ? [...requiredFields.filter(id => id !== subfieldId), subfieldId]
        : requiredFields.filter(id => id !== subfieldId);

      return {
        ...field,
        fieldConfig: {
          ...addressField.fieldConfig,
          requiredFields: updatedRequiredFields
        }
      } as FormFieldConfig;
    }

    return field;
  },

  /**
   * Validate a form value against field configuration
   */
  validateFieldValue(field: FormFieldConfig, value: any): { isValid: boolean; error?: string } {
    // Basic required field validation
    if (this.isFieldRequired(field)) {
      if (value === null || value === undefined || value === '') {
        return { isValid: false, error: `${field.label} is required` };
      }

      // Array fields (multiple choice, checkbox list)
      if (Array.isArray(value) && value.length === 0) {
        return { isValid: false, error: `${field.label} is required` };
      }

      // Object fields (contact-info, address)
      if (typeof value === 'object' && value !== null) {
        if (field.type === 'contact-info') {
          const contactField = field as ContactInfoFieldConfig;
          const requiredFields = contactField.fieldConfig?.requiredFields || [];
          
          for (const requiredField of requiredFields) {
            if (!value[requiredField] || value[requiredField].trim() === '') {
              return { isValid: false, error: `${field.label} - ${requiredField} is required` };
            }
          }
        }

        if (field.type === 'address') {
          const addressField = field as AddressFieldConfig;
          const requiredFields = addressField.fieldConfig?.requiredFields || [];
          
          for (const requiredField of requiredFields) {
            if (!value[requiredField] || value[requiredField].trim() === '') {
              return { isValid: false, error: `${field.label} - ${requiredField} is required` };
            }
          }
        }
      }
    }

    // Type-specific validations
    if (field.type === 'number' && value !== '' && value !== null && value !== undefined) {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return { isValid: false, error: `${field.label} must be a valid number` };
      }
    }

    return { isValid: true };
  },

  /**
   * Clean form data by removing empty/invalid values
   */
  cleanFormData(formData: Record<string, any>, questions: FormFieldConfig[]): Record<string, any> {
    const cleaned: Record<string, any> = {};

    questions.forEach(question => {
      const value = formData[question.name];
      
      if (value !== null && value !== undefined) {
        if (typeof value === 'string' && value.trim() !== '') {
          cleaned[question.name] = value.trim();
        } else if (Array.isArray(value) && value.length > 0) {
          cleaned[question.name] = value;
        } else if (typeof value === 'object' && value !== null) {
          // Clean object fields (contact-info, address)
          const cleanedObject: Record<string, any> = {};
          let hasValidData = false;

          for (const [key, val] of Object.entries(value)) {
            if (typeof val === 'string' && val.trim() !== '') {
              cleanedObject[key] = val.trim();
              hasValidData = true;
            }
          }

          if (hasValidData) {
            cleaned[question.name] = cleanedObject;
          }
        } else if (typeof value === 'boolean' || typeof value === 'number') {
          cleaned[question.name] = value;
        }
      }
    });

    return cleaned;
  },

  /**
   * Get form errors for all fields
   */
  validateAllFields(formData: Record<string, any>, questions: FormFieldConfig[]): Record<string, string> {
    const errors: Record<string, string> = {};

    questions.forEach(question => {
      const value = formData[question.name];
      const validation = this.validateFieldValue(question, value);
      
      if (!validation.isValid && validation.error) {
        errors[question.name] = validation.error;
      }
    });

    return errors;
  },

  /**
   * Check if form data is valid
   */
  isFormValid(formData: Record<string, any>, questions: FormFieldConfig[]): boolean {
    const errors = this.validateAllFields(formData, questions);
    return Object.keys(errors).length === 0;
  }
};

// Export individual functions for convenience
export const generateFieldName = formHelpers.generateFieldName;
export const generateFieldId = formHelpers.generateFieldId;
export const getDefaultValue = formHelpers.getDefaultValue;
export const findQuestionById = formHelpers.findQuestionById;
export const validateFieldValue = formHelpers.validateFieldValue;
export const isFormValid = formHelpers.isFormValid;