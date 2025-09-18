import { FlowNode } from '../form-flow-tree';
import { FormFieldConfig } from '@/features/booking/lib/form-field-types';

/**
 * Enhanced validation system for form editor with specific rules for enabled forms.
 * This validation determines whether a form can be published and whether changes
 * to an enabled form can be saved.
 */

export interface ValidationResult {
  isValid: boolean;
  canPublish: boolean;
  errors: ValidationIssue[];
  sections: ValidationSectionState;
}

export interface ValidationIssue {
  id: string;
  type: 'error';
  code: string;
  message: string;
  section: 'services' | 'questions' | 'branding' | 'metadata';
  path?: string;
  nodeId?: string;
  fieldName?: string;
}

export interface ValidationSectionState {
  services: {
    hasErrors: boolean;
    errorCount: number;
  };
  questions: {
    hasErrors: boolean;
    errorCount: number;
  };
  branding: {
    hasErrors: boolean;
    errorCount: number;
  };
  metadata: {
    hasErrors: boolean;
    errorCount: number;
  };
}

/**
 * Main validation function for the entire form configuration
 */
export function validateFormConfiguration(config: {
  internalName: string;
  slug: string;
  serviceTree: FlowNode;
  baseQuestions: FormFieldConfig[];
  theme: 'light' | 'dark';
  primaryColor: string;
  isEnabled?: boolean;
}): ValidationResult {
  const errors: ValidationIssue[] = [];

  // Validate metadata
  const metadataValidation = validateMetadata(config.internalName, config.slug);
  errors.push(...metadataValidation.errors);

  // Validate service tree
  const serviceValidation = validateServiceTree(config.serviceTree);
  errors.push(...serviceValidation.errors);

  // Validate questions
  const questionValidation = validateQuestions(config.baseQuestions);
  errors.push(...questionValidation.errors);

  // Validate branding
  const brandingValidation = validateBranding(config.theme, config.primaryColor);
  errors.push(...brandingValidation.errors);

  // Calculate section states
  const sections = calculateSectionStates(errors);

  return {
    isValid: errors.length === 0,
    canPublish: errors.length === 0,
    errors,
    sections
  };
}

/**
 * Validate form metadata (name and slug)
 */
function validateMetadata(internalName: string, slug: string): {
  errors: ValidationIssue[]
} {
  const errors: ValidationIssue[] = [];

  // Internal name validation
  if (!internalName || internalName.trim() === '') {
    errors.push({
      id: 'metadata-missing-name',
      type: 'error',
      code: 'MISSING_INTERNAL_NAME',
      message: 'Form must have an internal name',
      section: 'metadata'
    });
  }

  // Slug validation
  if (!slug || slug.trim() === '') {
    errors.push({
      id: 'metadata-missing-slug',
      type: 'error',
      code: 'MISSING_SLUG',
      message: 'Form must have a URL slug',
      section: 'metadata'
    });
  } else {
    // Detailed slug format validation
    if (!/^[a-z0-9-]+$/.test(slug)) {
      errors.push({
        id: 'metadata-invalid-slug-chars',
        type: 'error',
        code: 'INVALID_SLUG_CHARS',
        message: 'Slug can only contain lowercase letters, numbers, and hyphens',
        section: 'metadata'
      });
    }
    if (slug.startsWith('-') || slug.endsWith('-')) {
      errors.push({
        id: 'metadata-invalid-slug-edges',
        type: 'error',
        code: 'INVALID_SLUG_EDGES',
        message: 'Slug cannot start or end with a hyphen',
        section: 'metadata'
      });
    }
    if (slug.includes('--')) {
      errors.push({
        id: 'metadata-invalid-slug-double',
        type: 'error',
        code: 'INVALID_SLUG_DOUBLE_HYPHEN',
        message: 'Slug cannot contain consecutive hyphens',
        section: 'metadata'
      });
    }
    if (slug.length < 3) {
      errors.push({
        id: 'metadata-slug-too-short',
        type: 'error',
        code: 'SLUG_TOO_SHORT',
        message: 'Slug must be at least 3 characters long',
        section: 'metadata'
      });
    }
    if (slug.length > 50) {
      errors.push({
        id: 'metadata-slug-too-long',
        type: 'error',
        code: 'SLUG_TOO_LONG',
        message: 'Slug cannot be longer than 50 characters',
        section: 'metadata'
      });
    }
  }

  return { errors };
}

/**
 * Validate the service tree structure
 */
function validateServiceTree(tree: FlowNode): {
  errors: ValidationIssue[]
} {
  const errors: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  // Check if tree has any services
  const hasServices = hasAnyServices(tree);
  if (!hasServices) {
    errors.push({
      id: 'services-empty-tree',
      type: 'error',
      code: 'EMPTY_SERVICE_TREE',
      message: 'Form must have at least one service',
      section: 'services'
    });
  }

  // Recursive validation
  validateNode(tree, '', errors, seenIds);

  return { errors };
}

/**
 * Recursively validate a node and its children
 */
function validateNode(
  node: FlowNode,
  path: string,
  errors: ValidationIssue[],
  seenIds: Set<string>
): void {
  // Create user-friendly node path with fallback for unnamed nodes
  const getNodeDisplayName = (node: FlowNode): string => {
    if (node.label && node.label.trim() !== '') {
      return node.label;
    }

    // Provide user-friendly fallback based on node type
    switch (node.type) {
      case 'service':
        return 'Unnamed Service';
      case 'split':
        return 'Unnamed Group';
      case 'start':
        return 'Start';
      default:
        return 'Unnamed Item';
    }
  };

  const nodePath = path ? `${path} > ${getNodeDisplayName(node)}` : getNodeDisplayName(node);

  // Check for duplicate IDs
  if (seenIds.has(node.id)) {
    errors.push({
      id: `node-duplicate-${node.id}`,
      type: 'error',
      code: 'DUPLICATE_NODE_ID',
      message: `Duplicate node ID: ${node.id}`,
      section: 'services',
      path: nodePath,
      nodeId: node.id
    });
  }
  seenIds.add(node.id);

  // Validate based on node type
  if (node.type === 'service') {
    validateServiceNode(node, nodePath, errors);
  } else if (node.type === 'split') {
    validateGroupNode(node, nodePath, errors);
  }

  // Validate children
  if (node.children) {
    node.children.forEach(child => {
      validateNode(child, nodePath, errors, seenIds);
    });
  }
}

/**
 * Validate a service node
 */
function validateServiceNode(
  node: FlowNode,
  path: string,
  errors: ValidationIssue[]
): void {
  // Critical errors
  if (!node.label || node.label.trim() === '') {
    errors.push({
      id: `service-missing-name-${node.id}`,
      type: 'error',
      code: 'SERVICE_MISSING_NAME',
      message: 'Service must have a name',
      section: 'services',
      path,
      nodeId: node.id
    });
  }

  // Check for assigned employees - CRITICAL for enabled forms
  if (!node.assignedEmployeeIds || node.assignedEmployeeIds.length === 0) {
    errors.push({
      id: `service-no-employees-${node.id}`,
      type: 'error',
      code: 'SERVICE_NO_EMPLOYEES',
      message: `Service "${node.label}" has no assigned employees`,
      section: 'services',
      path,
      nodeId: node.id
    });
  }

  // Check duration
  if (node.duration === undefined || node.duration === null || node.duration <= 0) {
    errors.push({
      id: `service-invalid-duration-${node.id}`,
      type: 'error',
      code: 'SERVICE_INVALID_DURATION',
      message: `Service "${node.label}" must have a valid duration`,
      section: 'services',
      path,
      nodeId: node.id
    });
  }

  // Check price (only validate if set - price is optional)
  if (node.price !== undefined && node.price !== null && node.price < 0) {
    errors.push({
      id: `service-invalid-price-${node.id}`,
      type: 'error',
      code: 'SERVICE_INVALID_PRICE',
      message: `Service "${node.label}" price cannot be negative`,
      section: 'services',
      path,
      nodeId: node.id
    });
  }


  // Check booking interval
  if (node.interval && node.duration && node.interval > node.duration) {
    errors.push({
      id: `service-invalid-interval-${node.id}`,
      type: 'error',
      code: 'SERVICE_INVALID_INTERVAL',
      message: `Service "${node.label}" booking interval cannot exceed service duration`,
      section: 'services',
      path,
      nodeId: node.id
    });
  }
}

/**
 * Validate a group node
 */
function validateGroupNode(
  node: FlowNode,
  path: string,
  errors: ValidationIssue[]
): void {
  if (!node.label || node.label.trim() === '') {
    errors.push({
      id: `group-missing-name-${node.id}`,
      type: 'error',
      code: 'GROUP_MISSING_NAME',
      message: 'Group must have a name',
      section: 'services',
      path,
      nodeId: node.id
    });
  }
}

/**
 * Validate base questions configuration
 */
function validateQuestions(questions: FormFieldConfig[]): {
  errors: ValidationIssue[]
} {
  const errors: ValidationIssue[] = [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();

  // Skip validation if no questions (optional)
  if (!questions || questions.length === 0) {
    return { errors };
  }

  // Validate each question
  questions.forEach((question, index) => {
    // Check for missing label
    if (!question.label || question.label.trim() === '') {
      errors.push({
        id: `question-missing-label-${question.id}`,
        type: 'error',
        code: 'QUESTION_MISSING_LABEL',
        message: `Question ${index + 1} is missing a label`,
        section: 'questions',
        fieldName: question.name
      });
    }

    // Check for missing name
    if (!question.name || question.name.trim() === '') {
      errors.push({
        id: `question-missing-name-${question.id}`,
        type: 'error',
        code: 'QUESTION_MISSING_NAME',
        message: `Question "${question.label}" is missing a field name`,
        section: 'questions'
      });
    }

    // Check for duplicate names
    if (question.name && seenNames.has(question.name)) {
      errors.push({
        id: `question-duplicate-name-${question.id}`,
        type: 'error',
        code: 'QUESTION_DUPLICATE_NAME',
        message: `Duplicate field name: ${question.name}`,
        section: 'questions',
        fieldName: question.name
      });
    }
    if (question.name) seenNames.add(question.name);

    // Check for duplicate IDs
    if (question.id && seenIds.has(question.id)) {
      errors.push({
        id: `question-duplicate-id-${question.id}`,
        type: 'error',
        code: 'QUESTION_DUPLICATE_ID',
        message: `Duplicate question ID: ${question.id}`,
        section: 'questions'
      });
    }
    if (question.id) seenIds.add(question.id);

    // Validate choice fields
    if (['dropdown', 'radio', 'multiple-choice', 'checkbox-list'].includes(question.type)) {
      const choiceField = question as any;
      if (!choiceField.options || !Array.isArray(choiceField.options)) {
        errors.push({
          id: `question-no-options-${question.id}`,
          type: 'error',
          code: 'QUESTION_NO_OPTIONS',
          message: `Question "${question.label}" must have options`,
          section: 'questions',
          fieldName: question.name
        });
      } else if (choiceField.options.length === 0) {
        errors.push({
          id: `question-empty-options-${question.id}`,
          type: 'error',
          code: 'QUESTION_EMPTY_OPTIONS',
          message: `Question "${question.label}" has no options to choose from`,
          section: 'questions',
          fieldName: question.name
        });
      }
    }
  });

  return { errors };
}

/**
 * Validate branding settings
 */
function validateBranding(theme: string, primaryColor: string): {
  errors: ValidationIssue[]
} {
  const errors: ValidationIssue[] = [];

  // Validate theme
  if (theme && !['light', 'dark'].includes(theme)) {
    errors.push({
      id: 'branding-invalid-theme',
      type: 'error',
      code: 'INVALID_THEME',
      message: 'Theme must be either "light" or "dark"',
      section: 'branding'
    });
  }

  // Validate primary color
  if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
    errors.push({
      id: 'branding-invalid-color',
      type: 'error',
      code: 'INVALID_PRIMARY_COLOR',
      message: 'Primary color must be a valid hex color (e.g., #FF0000)',
      section: 'branding'
    });
  }

  return { errors };
}

/**
 * Helper function to check if tree has any services
 */
function hasAnyServices(node: FlowNode): boolean {
  if (node.type === 'service') return true;
  if (node.children) {
    return node.children.some(child => hasAnyServices(child));
  }
  return false;
}

/**
 * Calculate section states based on errors and warnings
 */
function calculateSectionStates(
  errors: ValidationIssue[]
): ValidationSectionState {
  const sections: ValidationSectionState = {
    services: {
      hasErrors: false,
      errorCount: 0
    },
    questions: {
      hasErrors: false,
      errorCount: 0
    },
    branding: {
      hasErrors: false,
      errorCount: 0
    },
    metadata: {
      hasErrors: false,
      errorCount: 0
    }
  };

  // Count errors
  errors.forEach(error => {
    const section = sections[error.section];
    if (section) {
      section.hasErrors = true;
      section.errorCount++;
    }
  });

  return sections;
}

/**
 * Check if form configuration can be saved based on enabled state
 */
export function canSaveForm(
  isEnabled: boolean,
  validationResult: ValidationResult
): boolean {
  // Disabled forms can always be saved
  if (!isEnabled) {
    return true;
  }

  // Enabled forms can only be saved if valid
  return validationResult.isValid;
}

/**
 * Get user-friendly message for why save is blocked
 */
export function getSaveBlockedMessage(validationResult: ValidationResult): string {
  const errorCount = validationResult.errors.length;

  if (errorCount === 0) {
    return '';
  }

  if (errorCount === 1) {
    return '1 issue';
  }

  return `${errorCount} issues found`;
}

/**
 * Get navigation path to a specific validation issue
 */
export function getIssueNavigationPath(issue: ValidationIssue): {
  level: string;
  nodeId?: string;
} {
  // Navigate based on specific error code for precise targeting
  switch (issue.code) {
    // Service employee assignment issues
    case 'SERVICE_NO_EMPLOYEES':
      return {
        level: 'service-employees',
        nodeId: issue.nodeId
      };

    // Service details form issues
    case 'SERVICE_MISSING_NAME':
    case 'SERVICE_INVALID_DURATION':
    case 'SERVICE_INVALID_PRICE':
      return {
        level: 'service-details-form',
        nodeId: issue.nodeId
      };

    // Group/service structure issues
    case 'GROUP_MISSING_NAME':
      return {
        level: 'group-details',
        nodeId: issue.nodeId
      };

    // Form metadata issues
    case 'MISSING_INTERNAL_NAME':
    case 'MISSING_SLUG':
    case 'INVALID_SLUG_CHARS':
    case 'INVALID_SLUG_EDGES':
    case 'INVALID_SLUG_DOUBLE_HYPHEN':
    case 'SLUG_TOO_SHORT':
    case 'SLUG_TOO_LONG':
      return { level: 'root' };

    // Question configuration issues
    case 'QUESTION_MISSING_LABEL':
    case 'QUESTION_MISSING_NAME':
    case 'QUESTION_DUPLICATE_NAME':
    case 'QUESTION_DUPLICATE_ID':
    case 'QUESTION_NO_OPTIONS':
    case 'QUESTION_EMPTY_OPTIONS':
      return { level: 'questions' };

    // Branding issues
    case 'INVALID_THEME':
    case 'INVALID_PRIMARY_COLOR':
      return { level: 'branding' };

    // Service structure issues
    case 'EMPTY_SERVICE_TREE':
    case 'DUPLICATE_NODE_ID':
      return { level: 'services' };

    // Fallback to section-based navigation
    default:
      if (issue.section === 'services' && issue.nodeId) {
        return {
          level: 'service-details',
          nodeId: issue.nodeId
        };
      }

      const levelMap = {
        'services': 'services',
        'questions': 'questions',
        'branding': 'branding',
        'metadata': 'root'
      };

      return { level: levelMap[issue.section] || 'root' };
  }
}