import { FormFieldConfig, ContactInfoFieldConfig, isFieldRequired, isSubfieldRequired } from "@/features/booking/lib/form-field-types";

export interface ValidationMessages {
    required?: string;
    minLength?: string;
    maxLength?: string;
    pattern?: string;
    email?: string;
}

const DEFAULT_MESSAGES: ValidationMessages = {
    required: "This field is required",
    minLength: "Input is too short",
    maxLength: "Input is too long",
    pattern: "Invalid format",
    email: "Invalid email address",
};

/**
 * Standard validation error messages
 */
export const ValidationErrorMessages = {
  REQUIRED_FIELD: "Please complete this field",
  REQUIRED_CHECKBOX: "Please check this box to continue", 
  REQUIRED_SELECT: "Please select an option",
  INVALID_EMAIL: "Please enter a valid email address"
};

/**
 * Email validation pattern
 */
export const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/**
 * Generates validation rules for a field based on its type and required status
 * @param field The field configuration
 * @param subfieldPath Optional subfield path
 * @returns Validation rules object for react-hook-form
 */
export function getFieldValidation(field: FormFieldConfig, subfieldPath?: string) {
    // For subfields in complex types like contact-info and address
    if (subfieldPath) {
        return getSubfieldValidation(field, subfieldPath);
    }

    // For regular fields
    const rules: Record<string, any> = {};
    
    // Common validation properties
    const required = isFieldRequired(field);
    const minLength = field.validationRules?.minLength;
    const maxLength = field.validationRules?.maxLength;
    const pattern = field.validationRules?.pattern;
    const customMessage = field.validationRules?.message || DEFAULT_MESSAGES.required;

    // Add validation rules based on field type and configuration
    if (required) {
        // Special validation for different field types
        if (field.type === 'multiple-choice') {
            // For multiple choice fields, check that array has at least one item
            rules.validate = (value: any) => {
                // Value can be a string for single-select or an array for multi-select
                if (Array.isArray(value)) {
                    return value.length > 0 || customMessage;
                }
                return !!value || customMessage;
            };
        } else if (field.type === 'file-upload') {
            // For file uploads, check that there's at least one file
            rules.validate = (value: any) => {
                if (Array.isArray(value)) {
                    return value.length > 0 || customMessage;
                }
                return !!value || customMessage;
            };
        } else {
            // Standard required validation for other fields
            rules.required = customMessage;
        }
    }

    // Add minLength validation if specified
    if (minLength !== undefined) {
        rules.minLength = {
            value: minLength,
            message: field.validationRules?.messages?.minLength || DEFAULT_MESSAGES.minLength,
        };
    }

    // Add maxLength validation if specified
    if (maxLength !== undefined) {
        rules.maxLength = {
            value: maxLength,
            message: field.validationRules?.messages?.maxLength || DEFAULT_MESSAGES.maxLength,
        };
    }

    // Add pattern validation if specified
    if (pattern) {
        rules.pattern = {
            value: new RegExp(pattern),
            message: field.validationRules?.messages?.pattern || DEFAULT_MESSAGES.pattern,
        };
    }

    // Email Validation (apply only to short-text fields marked as email)
    if ((field.type === 'short-text') && field.validationRules?.email) {
      const emailMessage = field.validationRules?.messages?.email || 'Invalid email address';
      rules.pattern = {
        value: EMAIL_PATTERN,
        message: emailMessage,
      };
    }

    // For contact-info fields, apply validation to each subfield
    if (field.type === 'contact-info') {
        const contactField = field as ContactInfoFieldConfig;
        const contactConfig = contactField.fieldConfig || {};
        
        // Add validate function to check required subfields
        rules.validate = (value: any) => {
            if (!value) return required ? customMessage : true;
            
            // Check each required field based on configuration
            if (contactConfig.firstNameRequired && (!value.firstName || value.firstName.trim() === '')) {
                return "First name is required";
            }
            
            if (contactConfig.lastNameRequired && (!value.lastName || value.lastName.trim() === '')) {
                return "Last name is required";
            }
            
            if (contactConfig.emailRequired && (!value.email || value.email.trim() === '')) {
                return "Email is required";
            }
            
            if (contactConfig.phoneRequired && (!value.phone || value.phone.trim() === '')) {
                return "Phone is required";
            }
            
            if (contactConfig.companyRequired && (!value.company || value.company.trim() === '')) {
                return "Company is required";
            }
            
            return true;
        };
    }

    // For address fields, apply validation to each subfield
    if (field.type === 'address') {
        
        // Add validate function to check required address fields
        rules.validate = (value: any) => {
            if (!value) return required ? customMessage : true;
            
            // Check each field based on address being required
            if (required) {
                if (!value.street || value.street.trim() === '') {
                    return "Street address is required";
                }
                
                if (!value.city || value.city.trim() === '') {
                    return "City is required";
                }
                
                if (!value.state || value.state.trim() === '') {
                    return "State is required";
                }
                
                if (!value.zip || value.zip.trim() === '') {
                    return "ZIP code is required";
                }
            }
            
            return true;
        };
    }

    return rules;
}

// Helper to get validation rules for a specific subfield path
function getSubfieldValidation(field: FormFieldConfig, subfieldPath: string) {
    const rules: Record<string, any> = {};
    const parts = subfieldPath.split('.');
    const subfieldName = parts[parts.length - 1];
    
    // Default message
    const customMessage = field.validationRules?.message || DEFAULT_MESSAGES.required;
    
    // Contact info field validation
    if (field.type === 'contact-info') {
        const contactField = field as ContactInfoFieldConfig;
        const contactConfig = contactField.fieldConfig || {};
        
        // First name validation
        if (subfieldName === 'firstName' && contactConfig.firstNameRequired) {
            rules.required = "First name is required";
        }
        
        // Last name validation
        if (subfieldName === 'lastName' && contactConfig.lastNameRequired) {
            rules.required = "Last name is required";
        }
        
        // Email validation
        if (subfieldName === 'email') {
            if (contactConfig.emailRequired) {
                rules.required = "Email is required";
            }
            rules.pattern = {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: field.validationRules?.messages?.email || DEFAULT_MESSAGES.email,
            };
        }
        
        // Phone validation
        if (subfieldName === 'phone' && contactConfig.phoneRequired) {
            rules.required = "Phone number is required";
        }
    }
    // Address field validation
    else if (field.type === 'address') {
        const isRequired = isFieldRequired(field);
        
        if (isRequired) {
            // Street validation
            if (subfieldName === 'street') {
                rules.required = "Street address is required";
            }
            
            // City validation
            if (subfieldName === 'city') {
                rules.required = "City is required";
            }
            
            // State validation
            if (subfieldName === 'state') {
                rules.required = "State is required";
            }
            
            // ZIP validation
            if (subfieldName === 'zip') {
                rules.required = "ZIP code is required";
            }
        }
    }
    // For other field types
    else if (isSubfieldRequired(field, subfieldName)) {
        rules.required = customMessage;
    }
    
    return rules;
}

/**
 * Determines if a field value should show an error based on validation rules
 * @param fieldValue The current value of the field
 * @param isRequired Whether the field is required
 * @param showValidation Whether validation errors should be displayed
 * @returns Boolean indicating if the field should show an error
 */
export function shouldShowFieldError(fieldValue: any, isRequired: boolean, showValidation: boolean = false): boolean {
    // Always show validation errors when showValidation is true
    if (!showValidation) {
        return false;
    }
    
    // Check if the field is empty
    const isEmpty = 
        fieldValue === undefined || 
        fieldValue === null || 
        fieldValue === "" ||
        (Array.isArray(fieldValue) && fieldValue.length === 0) ||
        (typeof fieldValue === 'object' && Object.keys(fieldValue).length > 0 && 
            Object.values(fieldValue).every(v => v === "" || v === null || v === undefined));
    
    // Show error if required and empty
    return isRequired && isEmpty;
}