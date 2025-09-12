import { FlowNode } from '../form-flow-tree';
import { FormFieldConfig, FormFieldType } from '@/features/booking/lib/form-field-types';

/**
 * Validation utilities for form editor data structures.
 * Provides comprehensive validation for nodes, fields, and form data.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
  field?: string;
}

export const validation = {
  /**
   * Validate a FlowNode tree structure
   */
  validateTree(tree: FlowNode, path: string = ''): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const seenIds = new Set<string>();

    const validateNode = (node: FlowNode, currentPath: string) => {
      const nodePath = currentPath ? `${currentPath} > ${node.label || node.id}` : node.label || node.id;

      // Required field validations
      if (!node.id) {
        errors.push({
          code: 'MISSING_ID',
          message: 'Node is missing required ID',
          path: nodePath
        });
      }

      if (!node.type) {
        errors.push({
          code: 'MISSING_TYPE',
          message: 'Node is missing required type',
          path: nodePath
        });
      }

      if (!node.label || node.label.trim() === '') {
        errors.push({
          code: 'MISSING_LABEL',
          message: 'Node is missing required label',
          path: nodePath
        });
      }

      // Duplicate ID check
      if (node.id && seenIds.has(node.id)) {
        errors.push({
          code: 'DUPLICATE_ID',
          message: `Duplicate node ID: ${node.id}`,
          path: nodePath
        });
      } else if (node.id) {
        seenIds.add(node.id);
      }

      // Type-specific validations
      if (node.type === 'service') {
        if (!node.description) {
          warnings.push({
            code: 'MISSING_DESCRIPTION',
            message: 'Service node should have a description for better user experience',
            path: nodePath
          });
        }

        if (node.price === undefined || node.price === null) {
          warnings.push({
            code: 'MISSING_PRICE',
            message: 'Service node should have pricing information',
            path: nodePath
          });
        } else {
          // Validate price is a valid number
          const priceValue = typeof node.price === 'string' ? 
            parseFloat(node.price.replace(/[$,]/g, '')) : node.price;
          
          if (isNaN(priceValue) || priceValue < 0) {
            errors.push({
              code: 'INVALID_PRICE',
              message: `Invalid price value: ${node.price}. Price must be a positive number.`,
              path: nodePath
            });
          }
        }
      }

      if (node.type === 'split' && (!node.children || node.children.length === 0)) {
        warnings.push({
          code: 'EMPTY_GROUP',
          message: 'Group node has no children - consider removing or adding services',
          path: nodePath
        });
      }

      // Validate additional questions if present
      if (node.additionalQuestions && node.additionalQuestions.length > 0) {
        const questionValidation = this.validateQuestions(node.additionalQuestions, `${nodePath} Questions`);
        errors.push(...questionValidation.errors);
        if (questionValidation.warnings) {
          warnings.push(...questionValidation.warnings);
        }
      }

      // Recursively validate children
      if (node.children) {
        node.children.forEach(child => validateNode(child, nodePath));
      }
    };

    validateNode(tree, path);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  },

  /**
   * Validate form field configurations
   */
  validateQuestions(questions: FormFieldConfig[], path: string = 'Questions'): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    questions.forEach((question, index) => {
      const questionPath = `${path}[${index}] - ${question.label || question.id}`;

      // Required field validations
      if (!question.id) {
        errors.push({
          code: 'MISSING_QUESTION_ID',
          message: 'Question is missing required ID',
          path: questionPath,
          field: 'id'
        });
      }

      if (!question.name) {
        errors.push({
          code: 'MISSING_QUESTION_NAME',
          message: 'Question is missing required name',
          path: questionPath,
          field: 'name'
        });
      }

      if (!question.label || question.label.trim() === '') {
        errors.push({
          code: 'MISSING_QUESTION_LABEL',
          message: 'Question is missing required label',
          path: questionPath,
          field: 'label'
        });
      }

      if (!question.type) {
        errors.push({
          code: 'MISSING_QUESTION_TYPE',
          message: 'Question is missing required type',
          path: questionPath,
          field: 'type'
        });
      }

      // Duplicate ID check
      if (question.id && seenIds.has(question.id)) {
        errors.push({
          code: 'DUPLICATE_QUESTION_ID',
          message: `Duplicate question ID: ${question.id}`,
          path: questionPath,
          field: 'id'
        });
      } else if (question.id) {
        seenIds.add(question.id);
      }

      // Duplicate name check
      if (question.name && seenNames.has(question.name)) {
        errors.push({
          code: 'DUPLICATE_QUESTION_NAME',
          message: `Duplicate question name: ${question.name}`,
          path: questionPath,
          field: 'name'
        });
      } else if (question.name) {
        seenNames.add(question.name);
      }

      // Type-specific validations
      this.validateQuestionType(question, questionPath, errors, warnings);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  },

  /**
   * Validate specific question type configurations
   */
  validateQuestionType(
    question: FormFieldConfig, 
    path: string, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    switch (question.type) {
      case 'dropdown':
      case 'radio':
      case 'multiple-choice':
      case 'checkbox-list':
        const choiceField = question as any;
        if (!choiceField.options || !Array.isArray(choiceField.options)) {
          errors.push({
            code: 'MISSING_OPTIONS',
            message: `${question.type} field must have options array`,
            path,
            field: 'options'
          });
        } else if (choiceField.options.length === 0) {
          warnings.push({
            code: 'EMPTY_OPTIONS',
            message: `${question.type} field has no options - users won't be able to select anything`,
            path,
            field: 'options'
          });
        } else {
          // Validate options structure
          choiceField.options.forEach((option: any, index: number) => {
            if (!option.value) {
              errors.push({
                code: 'MISSING_OPTION_VALUE',
                message: `Option ${index + 1} is missing value`,
                path: `${path} Option[${index}]`,
                field: 'value'
              });
            }
            if (!option.label) {
              errors.push({
                code: 'MISSING_OPTION_LABEL',
                message: `Option ${index + 1} is missing label`,
                path: `${path} Option[${index}]`,
                field: 'label'
              });
            }
          });

          // Check for duplicate option values
          const optionValues = choiceField.options.map((opt: any) => opt.value).filter(Boolean);
          const duplicateValues = optionValues.filter((value: string, index: number) => 
            optionValues.indexOf(value) !== index
          );
          
          if (duplicateValues.length > 0) {
            errors.push({
              code: 'DUPLICATE_OPTION_VALUES',
              message: `Duplicate option values found: ${duplicateValues.join(', ')}`,
              path,
              field: 'options'
            });
          }
        }
        break;

      case 'contact-info':
        const contactField = question as any;
        if (contactField.fieldConfig?.requiredFields) {
          const validSubfields = ['firstName', 'lastName', 'email', 'phone'];
          const invalidSubfields = contactField.fieldConfig.requiredFields.filter(
            (field: string) => !validSubfields.includes(field)
          );
          if (invalidSubfields.length > 0) {
            errors.push({
              code: 'INVALID_CONTACT_SUBFIELDS',
              message: `Invalid contact info subfields: ${invalidSubfields.join(', ')}`,
              path,
              field: 'fieldConfig.requiredFields'
            });
          }
        }
        break;

      case 'address':
        const addressField = question as any;
        if (addressField.fieldConfig?.requiredFields) {
          const validSubfields = ['street', 'street2', 'city', 'state', 'zip'];
          const invalidSubfields = addressField.fieldConfig.requiredFields.filter(
            (field: string) => !validSubfields.includes(field)
          );
          if (invalidSubfields.length > 0) {
            errors.push({
              code: 'INVALID_ADDRESS_SUBFIELDS',
              message: `Invalid address subfields: ${invalidSubfields.join(', ')}`,
              path,
              field: 'fieldConfig.requiredFields'
            });
          }
        }
        break;

      case 'number':
        // Could add min/max validation here if those fields exist
        break;

      case 'text':
      case 'textarea':
      case 'yes-no':
        // These types are valid as-is
        break;

      default:
        warnings.push({
          code: 'UNKNOWN_QUESTION_TYPE',
          message: `Unknown question type: ${question.type}`,
          path,
          field: 'type'
        });
    }
  },

  /**
   * Validate form data against question configurations
   */
  validateFormData(formData: Record<string, any>, questions: FormFieldConfig[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    questions.forEach(question => {
      const value = formData[question.name];
      const fieldPath = `Form Data - ${question.label}`;

      // Required field validation
      if (question.required) {
        if (value === null || value === undefined || value === '') {
          errors.push({
            code: 'REQUIRED_FIELD_EMPTY',
            message: `${question.label} is required`,
            path: fieldPath,
            field: question.name
          });
        } else if (Array.isArray(value) && value.length === 0) {
          errors.push({
            code: 'REQUIRED_ARRAY_EMPTY',
            message: `${question.label} is required`,
            path: fieldPath,
            field: question.name
          });
        } else if (typeof value === 'object' && value !== null) {
          // Validate contact-info and address required subfields
          this.validateRequiredSubfields(question, value, fieldPath, errors);
        }
      }

      // Type-specific validations for non-empty values
      if (value !== null && value !== undefined && value !== '') {
        this.validateFormDataType(question, value, fieldPath, errors, warnings);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  },

  /**
   * Validate required subfields for complex field types
   */
  validateRequiredSubfields(
    question: FormFieldConfig, 
    value: any, 
    path: string, 
    errors: ValidationError[]
  ): void {
    if (question.type === 'contact-info') {
      const contactField = question as any;
      const requiredFields = contactField.fieldConfig?.requiredFields || [];
      
      requiredFields.forEach((field: string) => {
        if (!value[field] || value[field].trim() === '') {
          errors.push({
            code: 'REQUIRED_SUBFIELD_EMPTY',
            message: `${question.label} - ${field} is required`,
            path,
            field: `${question.name}.${field}`
          });
        }
      });
    }

    if (question.type === 'address') {
      const addressField = question as any;
      const requiredFields = addressField.fieldConfig?.requiredFields || [];
      
      requiredFields.forEach((field: string) => {
        if (!value[field] || value[field].trim() === '') {
          errors.push({
            code: 'REQUIRED_SUBFIELD_EMPTY',
            message: `${question.label} - ${field} is required`,
            path,
            field: `${question.name}.${field}`
          });
        }
      });
    }
  },

  /**
   * Validate form data types
   */
  validateFormDataType(
    question: FormFieldConfig, 
    value: any, 
    path: string, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    switch (question.type) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push({
            code: 'INVALID_NUMBER',
            message: `${question.label} must be a valid number`,
            path,
            field: question.name
          });
        }
        break;

      case 'multiple-choice':
      case 'checkbox-list':
        if (!Array.isArray(value)) {
          errors.push({
            code: 'INVALID_ARRAY_TYPE',
            message: `${question.label} must be an array`,
            path,
            field: question.name
          });
        }
        break;

      case 'yes-no':
        if (typeof value !== 'boolean') {
          errors.push({
            code: 'INVALID_BOOLEAN_TYPE',
            message: `${question.label} must be true or false`,
            path,
            field: question.name
          });
        }
        break;

      case 'contact-info':
      case 'address':
        if (typeof value !== 'object' || value === null) {
          errors.push({
            code: 'INVALID_OBJECT_TYPE',
            message: `${question.label} must be an object`,
            path,
            field: question.name
          });
        }
        break;
    }
  },

  /**
   * Validate slug format
   */
  validateSlug(slug: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!slug) {
      errors.push({
        code: 'MISSING_SLUG',
        message: 'Slug is required'
      });
    } else {
      if (!/^[a-z0-9-]+$/.test(slug)) {
        errors.push({
          code: 'INVALID_SLUG_FORMAT',
          message: 'Slug can only contain lowercase letters, numbers, and hyphens'
        });
      }

      if (slug.startsWith('-') || slug.endsWith('-')) {
        errors.push({
          code: 'INVALID_SLUG_EDGES',
          message: 'Slug cannot start or end with a hyphen'
        });
      }

      if (slug.includes('--')) {
        errors.push({
          code: 'INVALID_SLUG_DOUBLE_HYPHEN',
          message: 'Slug cannot contain consecutive hyphens'
        });
      }

      if (slug.length < 3) {
        errors.push({
          code: 'SLUG_TOO_SHORT',
          message: 'Slug must be at least 3 characters long'
        });
      }

      if (slug.length > 50) {
        errors.push({
          code: 'SLUG_TOO_LONG',
          message: 'Slug cannot be longer than 50 characters'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate complete form configuration
   */
  validateFormConfig(config: {
    internalName?: string;
    slug?: string;
    serviceTree?: FlowNode;
    baseQuestions?: FormFieldConfig[];
    theme?: string;
    primaryColor?: string;
  }): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate required fields
    if (!config.internalName || config.internalName.trim() === '') {
      errors.push({
        code: 'MISSING_INTERNAL_NAME',
        message: 'Internal name is required'
      });
    }

    if (!config.slug) {
      errors.push({
        code: 'MISSING_SLUG',
        message: 'Slug is required'
      });
    } else {
      const slugValidation = this.validateSlug(config.slug);
      errors.push(...slugValidation.errors);
    }

    // Validate service tree
    if (!config.serviceTree) {
      errors.push({
        code: 'MISSING_SERVICE_TREE',
        message: 'Service tree is required'
      });
    } else {
      const treeValidation = this.validateTree(config.serviceTree);
      errors.push(...treeValidation.errors);
      if (treeValidation.warnings) {
        warnings.push(...treeValidation.warnings);
      }
    }

    // Validate base questions
    if (config.baseQuestions && config.baseQuestions.length > 0) {
      const questionsValidation = this.validateQuestions(config.baseQuestions);
      errors.push(...questionsValidation.errors);
      if (questionsValidation.warnings) {
        warnings.push(...questionsValidation.warnings);
      }
    }

    // Validate theme
    if (config.theme && !['light', 'dark'].includes(config.theme)) {
      errors.push({
        code: 'INVALID_THEME',
        message: 'Theme must be either "light" or "dark"'
      });
    }

    // Validate primary color (basic hex color check)
    if (config.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.primaryColor)) {
      errors.push({
        code: 'INVALID_PRIMARY_COLOR',
        message: 'Primary color must be a valid hex color (e.g., #FF0000)'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
};

// Export individual functions for convenience
export const validateTree = validation.validateTree;
export const validateQuestions = validation.validateQuestions;
export const validateFormData = validation.validateFormData;
export const validateSlug = validation.validateSlug;
export const validateFormConfig = validation.validateFormConfig;