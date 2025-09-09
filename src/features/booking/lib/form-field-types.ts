/**
 * Shared type definitions for form field configuration
 */

/**
 * FormFieldType is the definitive source for all field types in the form system.
 * It represents all possible types of fields that can be created in the form editor.
 */
export type FormFieldType =
    | "contact-info"
    | "address"
    | "short-text"
    | "long-text"
    | "date"
    | "file-upload"
    | "dropdown"
    | "yes-no"
    | "multiple-choice"
    | "required-checkbox";

/**
 * Interface for validation rule messages
 */
export interface ValidationMessages {
    required?: string;
    minLength?: string;
    maxLength?: string;
    pattern?: string;
    email?: string;
}

/**
 * Interface for validation rules applied to fields
 */
export interface ValidationRules {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
    email?: boolean;
    messages?: ValidationMessages;
}

/**
 * Interface for field options used in dropdown and multiple-choice fields.
 * Each option has an ID, label, and value, with optional visibility and required flags.
 */
export interface FieldOption {
    id: string;
    label: string;
    value: string;
    isVisible?: boolean;
    isRequired?: boolean;
    alwaysRequired?: boolean;
}

/**
 * Common props interface for field editor components.
 * This provides a unified interface for all field editing functionality.
 */
export interface FieldEditorProps {
    id: string;
    type: FormFieldType;
    options: FieldOption[];
    question?: string;
    showOptions?: boolean;
    onToggleOptions?: () => void;
    onRemove: (id: string) => void;
    onUpdateField: (id: string, updates: Partial<FieldEditorProps>) => void;
    usedFieldTypes?: FormFieldType[];
    isBeingDragged?: boolean;
    showDragIcon?: boolean;
    dragHandleProps?: {
        attributes?: Record<string, any>;
        listeners?: Record<string, any>;
    };
    onOptionValueChange?: (questionId: string, optionId: string, oldValue: string, newValue: string) => void;
    fieldConfig?: FormFieldConfig;
}

/**
 * Base interface for all form field configurations.
 * Every field config must have these properties.
 */
export interface BaseFieldConfig {
    id: string;
    name: string;
    label?: string;
    type: string;
    validationRules?: ValidationRules;
}

/**
 * Configuration for simple fields like text inputs, dates, yes/no, and required checkboxes.
 * These fields have basic configuration with a required flag.
 */
export interface SimpleFieldConfig extends BaseFieldConfig {
    type: 'short-text' | 'long-text' | 'date' | 'required-checkbox' | 'file-upload';
    isRequired: boolean;
}

export interface YesNoFieldConfig extends BaseFieldConfig {
    type: 'yes-no';
    isRequired: false;
}

export interface RequiredCheckboxFieldConfig extends BaseFieldConfig {
    type: 'required-checkbox';
    isRequired: true;
}

// Fields with multiple options (dropdown, radio, checkbox list)
export interface ChoiceOption {
  label: string;
  value: string;
}

/**
 * Configuration for choice fields like dropdowns and multiple choice questions.
 * These fields include an array of options.
 */
export interface ChoiceFieldConfig extends BaseFieldConfig {
    type: 'dropdown' | 'multiple-choice';
    isRequired: boolean;
    options: ChoiceOption[];
}

/**
 * Configuration for contact information fields.
 * Includes settings for which contact fields are required.
 */
export interface ContactInfoFieldConfig extends BaseFieldConfig {
    type: 'contact-info';
    fieldConfig: {
        firstNameRequired: boolean;
        lastNameRequired: boolean;
        emailRequired: boolean;
        phoneRequired: boolean;
        companyRequired: boolean;
    };
}

/**
 * Configuration for address fields.
 * Includes settings for which address components are required.
 */
export interface AddressFieldConfig extends BaseFieldConfig {
    type: 'address';
    fieldConfig: {
        streetRequired: boolean;
        street2Required: boolean;
        cityRequired: boolean;
        stateRequired: boolean;
        zipRequired: boolean;
    };
}

/**
 * Union type for all possible field configurations.
 * This is the primary type used throughout the form system.
 */
export type FormFieldConfig = 
  | SimpleFieldConfig 
  | ChoiceFieldConfig 
  | ContactInfoFieldConfig 
  | AddressFieldConfig
  | YesNoFieldConfig
  | RequiredCheckboxFieldConfig;

/**
 * Helper function to determine if a field is required 
 */
export function isFieldRequired(field: FormFieldConfig): boolean {
  if ('isRequired' in field) {
    return field.isRequired;
  } else if (field.type === 'contact-info') {
    const required = field.fieldConfig.firstNameRequired || 
           field.fieldConfig.lastNameRequired || 
           field.fieldConfig.emailRequired || 
           field.fieldConfig.phoneRequired;
    return required;
  } else if (field.type === 'address') {
    return field.fieldConfig.streetRequired || 
           field.fieldConfig.cityRequired || 
           field.fieldConfig.stateRequired || 
           field.fieldConfig.zipRequired;
  }
  return false;
}

/**
 * Helper function to determine if a specific subfield is required
 */
export function isSubfieldRequired(field: FormFieldConfig, subfieldId: string): boolean {
  if (field.type === 'contact-info') {
    switch (subfieldId) {
      case 'first-name': return field.fieldConfig.firstNameRequired;
      case 'last-name': return field.fieldConfig.lastNameRequired;
      case 'email': return field.fieldConfig.emailRequired;
      case 'phone': return field.fieldConfig.phoneRequired;
      case 'company': return field.fieldConfig.companyRequired;
      default: return false;
    }
  } else if (field.type === 'address') {
    switch (subfieldId) {
      case 'address': return field.fieldConfig.streetRequired;
      case 'address-line-2': return field.fieldConfig.street2Required;
      case 'city': return field.fieldConfig.cityRequired;
      case 'state': return field.fieldConfig.stateRequired;
      case 'zip': return field.fieldConfig.zipRequired;
      default: return false;
    }
  }
  
  // For simple fields and choice fields
  if ('isRequired' in field) {
    return field.isRequired;
  }
  
  return false;
}

/**
 * Creates a default configuration for a contact info field
 */
export function createDefaultContactInfoConfig(): ContactInfoFieldConfig['fieldConfig'] {
  return {
    firstNameRequired: true,  // Always required
    lastNameRequired: true,   // Always required
    emailRequired: true,
    phoneRequired: true,
    companyRequired: false
  };
}

/**
 * Creates a default configuration for an address field
 */
export function createDefaultAddressConfig(): AddressFieldConfig['fieldConfig'] {
  return {
    streetRequired: true,
    street2Required: false,
    cityRequired: true,
    stateRequired: true,
    zipRequired: true
  };
}

/**
 * Creates a field configuration from a FormFieldType
 * This is the newer version of createFieldConfigFromQuestionType that uses our internal FormFieldType
 * instead of the QuestionType from question.tsx
 */
export function createFieldConfigFromFormFieldType(
  type: FormFieldType,
  id?: string
): FormFieldConfig {
  const timestamp = Date.now();
  const fieldId = id || `field-${timestamp}`;
  
  switch (type) {
    case 'contact-info': {
      const config: ContactInfoFieldConfig = {
        id: fieldId,
        name: `contact_info_${timestamp}`,
        label: 'Contact Information',
        type: 'contact-info',
        fieldConfig: createDefaultContactInfoConfig()
      };
      return config;
    }
    
    case 'address': {
      const config: AddressFieldConfig = {
        id: fieldId,
        name: `address_${timestamp}`,
        label: 'Address',
        type: 'address',
        fieldConfig: createDefaultAddressConfig()
      };
      return config;
    }
    
    case 'dropdown': {
      const config: ChoiceFieldConfig = {
        id: fieldId,
        name: `dropdown_${timestamp}`,
        label: 'Dropdown',
        type: 'dropdown',
        isRequired: false,
        options: [
          { label: 'Option 1', value: 'Option 1' },
          { label: 'Option 2', value: 'Option 2' }
        ]
      };
      return config;
    }
    
    case 'multiple-choice': {
      const config: ChoiceFieldConfig = {
        id: fieldId,
        name: `multiple_choice_${timestamp}`,
        label: 'Select all that apply',
        type: 'multiple-choice',
        isRequired: false,
        options: [
          { label: 'Option 1', value: 'Option 1' },
          { label: 'Option 2', value: 'Option 2' }
        ]
      };
      return config;
    }
    
    case 'short-text': {
      const config: SimpleFieldConfig = {
        id: fieldId,
        name: `short_text_${timestamp}`,
        label: 'Short Text',
        type: 'short-text',
        isRequired: false,
      };
      return config;
    }
    
    case 'long-text': {
      const config: SimpleFieldConfig = {
        id: fieldId,
        name: `long_text_${timestamp}`,
        label: 'Long Text',
        type: 'long-text',
        isRequired: false,
      };
      return config;
    }
    
    case 'date': {
      const config: SimpleFieldConfig = {
        id: fieldId,
        name: `date_${timestamp}`,
        label: 'Date',
        type: 'date',
        isRequired: false,
      };
      return config;
    }
    
    case 'yes-no': {
      const config: YesNoFieldConfig = {
        id: fieldId,
        name: `yes_no_${timestamp}`,
        label: 'Yes/No Question',
        type: 'yes-no',
        isRequired: false,
      };
      return config;
    }
    
    case 'required-checkbox': {
      const config: SimpleFieldConfig = {
        id: fieldId,
        name: `required_checkbox_${timestamp}`,
        label: 'I agree to the terms and conditions',
        type: 'required-checkbox',
        isRequired: true,
      };
      return config;
    }
    
    case 'file-upload': {
      const config: SimpleFieldConfig = {
        id: fieldId,
        name: `file_upload_${timestamp}`,
        label: 'Upload File',
        type: 'file-upload',
        isRequired: false,
      };
      return config;
    }
    
    default: {
      const config: SimpleFieldConfig = {
        id: fieldId,
        name: `text_${timestamp}`,
        label: 'Text Field',
        type: 'short-text',
        isRequired: false,
      };
      return config;
    }
  }
}

// Define the type for Field component UI state (replacement for QuestionUIState)
export interface FieldUIState {
  showOptions?: boolean;
  usedFieldTypes?: FormFieldType[];
  isBeingDragged?: boolean;
  showDragIcon?: boolean;
  dragHandleProps?: any;
}

// Define handlers for field editing (replacement for QuestionHandlers)
export interface FieldHandlers {
  onRemove?: (id: string) => void;
  onUpdateField?: (id: string, updates: Partial<FieldEditorProps>) => void;
  onToggleOptions?: (id: string) => void;
  onOptionValueChange?: (fieldId: string, optionId: string, oldValue: string, newValue: string) => void;
}

// Field type labels for UI display
export const fieldTypeLabels: Record<FormFieldType, string> = {
    "contact-info": "Contact Information",
    "address": "Address",
    "short-text": "Short Text",
    "long-text": "Long Text",
    "date": "Date",
    "file-upload": "File Upload",
    "dropdown": "Dropdown",
    "yes-no": "Yes/No",
    "multiple-choice": "Multiple Choice",
    "required-checkbox": "Required Checkbox"
};

/**
 * Converts a FormFieldConfig to a FieldEditorProps object
 */
export function fieldConfigToFieldProps(
  config: FormFieldConfig,
  handlers: FieldHandlers = {},
  uiState: FieldUIState = {}
): FieldEditorProps {
  const { id, label, type } = config;
  const { onRemove, onUpdateField, onToggleOptions, onOptionValueChange } = handlers;
  const { showOptions, usedFieldTypes, isBeingDragged, showDragIcon, dragHandleProps } = uiState;
  
  // Get the field type directly from config type
  const fieldType = type as FormFieldType; // type is now directly FormFieldType or subtype
  
  // Create options based on the type of field
  let options: FieldOption[] = [];
  
  if (type === 'contact-info' && 'fieldConfig' in config) {
    const contactConfig = config.fieldConfig;
    options = [
      { id: 'first-name', label: 'First Name', value: '', isRequired: !!contactConfig.firstNameRequired },
      { id: 'last-name', label: 'Last Name', value: '', isRequired: !!contactConfig.lastNameRequired },
      { id: 'email', label: 'Email', value: '', isRequired: !!contactConfig.emailRequired },
      { id: 'phone', label: 'Phone', value: '', isRequired: !!contactConfig.phoneRequired },
      { id: 'company', label: 'Company', value: '', isRequired: !!contactConfig.companyRequired },
    ];
  } else if (type === 'address' && 'fieldConfig' in config) {
    const addressConfig = config.fieldConfig;
    options = [
      { id: 'street', label: 'Street', value: '', isRequired: !!addressConfig.streetRequired },
      { id: 'street2', label: 'Street 2', value: '', isRequired: !!addressConfig.street2Required },
      { id: 'city', label: 'City', value: '', isRequired: !!addressConfig.cityRequired },
      { id: 'state', label: 'State', value: '', isRequired: !!addressConfig.stateRequired },
      { id: 'zip', label: 'ZIP Code', value: '', isRequired: !!addressConfig.zipRequired }
    ];
  } else if ('options' in config) {
    // For dropdowns and multiple choice fields, map the options
    options = config.options.map(option => ({
      id: option.value,
      label: option.label,
      value: option.value,
      isRequired: false
    }));
  } else if ('isRequired' in config) {
    // For simple fields, just a main option
    options = [
      { id: 'main', label: label || '', value: '', isRequired: config.isRequired }
    ];
  }
  
  // Create dummy handlers if needed
  const defaultRemove = (_id: string) => { /* No remove handler provided */ };
  const defaultUpdateField = (_id: string, _updates: any) => { /* No update handler provided */ };
  
  const fieldProps: FieldEditorProps = {
    id,
    type: fieldType,
    options,
    question: label,
    
    // Use provided handlers or defaults
    onRemove: onRemove || defaultRemove,
    onUpdateField: onUpdateField || defaultUpdateField,
    
    // Optional handlers and state
    onToggleOptions: onToggleOptions ? () => onToggleOptions(id) : undefined,
    onOptionValueChange,
    showOptions,
    usedFieldTypes,
    isBeingDragged,
    showDragIcon,
    dragHandleProps,
    fieldConfig: config
  };
  
  return fieldProps;
}