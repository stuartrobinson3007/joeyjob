# Form Editor Validation & Publishing Control Plan

## Executive Summary

This document outlines a comprehensive approach for handling invalid form configurations in the booking form editor. The solution allows users to save work-in-progress forms while preventing invalid forms from being published to customers.

## Core Philosophy

- **Save When Valid**:
  - **Disabled forms**: Save at any stage of completion (work-in-progress)
  - **Enabled forms**: Only save valid changes; invalid changes remain in memory until resolved
- **Publish Only Valid**: Only forms passing all validation checks can be enabled/published
- **Protect Live Forms**: Prevent breaking changes to enabled forms from being saved
- **Clear Guidance**: Users receive clear, actionable feedback about validation issues
- **Progressive Disclosure**: Show validation issues contextually without overwhelming the interface

## Invalid Form Configuration Definitions

### Critical Errors (Block Publishing)

#### 1. Service Configuration Errors
- **No Assigned Employees**: Service has `assignedEmployeeIds` array empty
- **Missing Service Name**: Service `label` is empty or whitespace only
- **Invalid Service Duration**: Duration is 0, negative, or not set
- **Invalid Service Price**: Price is negative (when set - price is optional)

#### 2. Form Structure Errors
- **Empty Service Tree**: No services or groups defined under root
- **Orphaned Groups**: Groups with no child services or sub-groups
- **Duplicate Service IDs**: Multiple services with same ID
- **Invalid Node Structure**: Malformed tree structure or circular references

#### 3. Form Metadata Errors
- **Missing Internal Name**: Form `internalName` is empty
- **Invalid Slug**:
  - Empty slug
  - Contains uppercase letters
  - Contains special characters (except hyphens)
  - Starts or ends with hyphen
  - Contains consecutive hyphens
  - Less than 3 characters or more than 50 characters
- **Duplicate Slug**: Slug already exists for another form in the organization

#### 4. Question Configuration Errors
- **Missing Question Label**: Question has no label text
- **Missing Question Name**: Question has no field name for form submission
- **Invalid Choice Questions**: Dropdown/radio/checkbox with no options
- **Duplicate Question Names**: Multiple questions with same field name
- **Invalid Required Fields**: Required checkbox fields that can't be unchecked

### Warnings (Non-blocking but Important)

#### 1. Service Quality Issues
- **No Service Description**: Service lacks descriptive text
- **Default Employee Not Assigned**: No default employee selected when multiple are assigned
- **Very Short Service Duration**: Duration less than 15 minutes
- **Very Long Service Duration**: Duration more than 8 hours
- **No Buffer Time**: Service has 0 buffer time between appointments

#### 2. Form Completeness Issues
- **No Base Questions**: Form has no customer information fields
- **Missing Contact Information**: No contact info field in base questions
- **No Service-Specific Questions**: Services without additional questions
- **Incomplete Availability**: Services with very limited availability windows

#### 3. User Experience Issues
- **Generic Labels**: Using default labels like "New Service" or "New Group"
- **Missing Descriptions**: Groups without descriptions
- **Inconsistent Pricing**: Large price variations between similar services

## Saving Behavior Details

### Disabled/Draft Forms
- **Auto-save**: All changes save automatically regardless of validation state
- **Validation**: Shows warnings/errors but doesn't block saving
- **Enable button**: Disabled if validation errors exist, with tooltip explaining why
- **Use case**: Initial form creation, major restructuring, work-in-progress

### Enabled/Published Forms
- **Valid changes**: Auto-save normally with 2-second debounce
- **Invalid changes**:
  - Changes NOT saved to database
  - Remain in browser memory only
  - Save indicator shows "Resolve issues" badge
  - Enable toggle locked with tooltip "Resolve issues or disable form to save changes"
- **Resolution options**:
  1. Fix validation errors → Changes save automatically once valid
  2. Disable form first → Changes save but form goes offline
  3. Discard changes → Revert to last valid saved state

### Save Decision Logic
```typescript
const shouldSaveForm = (
  formData: FormData,
  isEnabled: boolean,
  validationResult: ValidationResult
): boolean => {
  // Always save disabled forms
  if (!isEnabled) {
    return true;
  }

  // For enabled forms, only save if valid
  return validationResult.errors.length === 0;
}

const handleAutosave = async (formData: FormData) => {
  const validationResult = await validateForm(formData);

  if (form.isEnabled && !validationResult.isValid) {
    // Don't save - keep changes in local state only
    setUnsavedChanges(formData);
    setValidationState({
      hasBlockingErrors: true,
      errors: validationResult.errors,
      cannotSaveReason: 'Form has validation errors'
    });
    updateSaveIndicator('resolve-issues');
    return;
  }

  // Save normally for disabled forms or valid enabled forms
  await saveForm(formData);
  updateSaveIndicator('saved');
}
```

### Exit Warnings
When user tries to leave editor with unsaved invalid changes on enabled form:
```
┌─────────────────────────────────────┐
│  ⚠️ Unsaved Changes                 │
├─────────────────────────────────────┤
│                                     │
│  Your changes cannot be saved       │
│  because the form has validation    │
│  errors and is currently enabled.   │
│                                     │
│  Options:                           │
│  • Fix validation errors            │
│  • Disable form to save changes     │
│  • Discard changes and exit         │
│                                     │
│ [Cancel] [Disable & Save] [Discard] │
└─────────────────────────────────────┘
```

## Implementation Architecture

### 1. Validation System Enhancement

```typescript
// New validation types
interface FormValidationState {
  isValid: boolean;
  canPublish: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  lastValidated: Date;
  sections: {
    [key: string]: {
      hasErrors: boolean;
      hasWarnings: boolean;
      issueCount: number;
    }
  }
}

interface ValidationIssue {
  id: string;
  type: 'error' | 'warning';
  code: string;
  message: string;
  section: 'services' | 'questions' | 'branding' | 'metadata';
  path: string; // Navigation path to the issue
  nodeId?: string; // For service-specific issues
  fieldName?: string; // For question-specific issues
  quickFix?: {
    label: string;
    action: () => void;
  }
}
```

### 2. Validation Rules Implementation

```typescript
// Service validation rules
const serviceValidationRules = [
  {
    code: 'SERVICE_NO_EMPLOYEES',
    check: (service: FlowNode) =>
      !service.assignedEmployeeIds ||
      service.assignedEmployeeIds.length === 0,
    type: 'error',
    message: 'Service must have at least one assigned employee',
    quickFix: {
      label: 'Assign employees',
      navigateTo: 'service-employees'
    }
  },
  // ... more rules
];
```

### 3. UI Component Updates

#### Save Status Indicator States
```typescript
type SaveStatusState =
  | 'saving'           // Currently saving
  | 'saved'            // Saved and valid
  | 'saved-with-issues' // Saved but has validation issues
  | 'error'            // Save failed
  | 'resolving-issues' // Published form with new invalid changes
```

#### Enable Button Behavior
```typescript
interface EnableButtonProps {
  isEnabled: boolean;
  validationState: FormValidationState;
  onToggleEnabled: () => void;
  onShowValidationSummary: () => void;
}

// Button states:
// 1. Valid form: Normal enable/disable toggle
// 2. Invalid form: Disabled with tooltip showing issue count
// 3. Published form with new issues: "Resolve Issues" button
```

### 4. Navigation Indicators

```typescript
interface NavigationItemProps {
  label: string;
  level: NavigationLevel;
  validationState?: {
    hasErrors: boolean;
    hasWarnings: boolean;
    count: number;
  }
}

// Visual indicators:
// - Red badge with error count
// - Yellow dot for warnings
// - Tooltip with issue summary on hover
```

## User Experience Flow

### 1. Creating a New Form
1. User creates new form (initially invalid - no services)
2. Form saves automatically but cannot be enabled
3. Enable button shows "Add services to enable form"
4. User adds services (still invalid - no employees assigned)
5. Navigation shows "Services (1 issue)" with red indicator
6. User assigns employees to service
7. All validation passes, enable button becomes active
8. User enables form for public use

### 2. Editing an Enabled Form
1. User opens enabled form for editing
2. Makes changes that introduce validation issues
3. **Changes are NOT saved to database**
4. Save indicator changes to "Resolve issues" badge
5. Form remains enabled with last valid configuration still live
6. User has three options:
   - Fix issues → Changes save automatically once valid
   - Disable form → Form goes offline but changes can save
   - Discard changes → Revert to last valid saved state
7. Once issues resolved, normal save indicator returns

### 3. Validation Summary Dialog
```
┌─────────────────────────────────────┐
│  ⚠️ Form Validation Issues          │
├─────────────────────────────────────┤
│                                     │
│  Cannot enable form due to:         │
│                                     │
│  🔴 Errors (2)                      │
│  • Hair Cutting Service:            │
│    No employees assigned            │
│    [Go to Service →]                │
│                                     │
│  • Consultation Service:            │
│    Missing availability settings    │
│    [Go to Service →]                │
│                                     │
│  🟡 Warnings (1)                    │
│  • Hair Coloring Service:           │
│    No description provided          │
│    [Go to Service →]                │
│                                     │
│ [Close]          [Fix All Issues]   │
└─────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Validation (Week 1)
- [ ] Extend validation utilities with employee/availability rules
- [ ] Add validation state to form data model
- [ ] Create validation context/hook for real-time checking
- [ ] Implement validation on save operations

### Phase 2: UI Integration (Week 2)
- [ ] Update SaveStatusIndicator with new states
- [ ] Modify enable button logic with validation checks
- [ ] Add validation badges to navigation items
- [ ] Create validation summary component

### Phase 3: User Guidance (Week 3)
- [ ] Implement quick-fix actions for common issues
- [ ] Add contextual help tooltips
- [ ] Create validation issue navigation system
- [ ] Add inline validation messages in forms

### Phase 4: Testing & Refinement (Week 4)
- [ ] Comprehensive testing of validation rules
- [ ] User testing with incomplete forms
- [ ] Performance optimization for validation
- [ ] Edge case handling and error recovery

## Technical Considerations

### Performance
- Debounce validation to avoid excessive computation
- Cache validation results between identical states
- Use Web Workers for complex validation if needed
- Validate only changed sections when possible

### Data Migration
- Existing forms need validation check on first load
- Auto-disable invalid published forms with notification
- Provide admin tools to bulk-validate forms
- Log validation issues for monitoring

### Error Handling
- Graceful degradation if validation fails
- Never block saving due to validation errors
- Clear error messages with actionable steps
- Fallback to manual validation if automated fails

## Success Metrics

### Technical Metrics
- Validation execution time < 100ms
- Zero false positives in validation
- 100% of published forms pass validation
- Autosave success rate > 99%

### User Experience Metrics
- Time to resolve validation issues
- Number of support tickets for form publishing
- User satisfaction with validation guidance
- Form completion rates

## Future Enhancements

### Phase 2 Features
- Validation presets for common service types
- Bulk fix operations for similar issues
- Validation history and audit trail
- Custom validation rules per organization

### Advanced Features
- AI-powered issue detection and suggestions
- Automated fix recommendations
- Cross-form validation (duplicate services)
- Integration with external validation services

## Conclusion

This validation system ensures data integrity while maintaining a smooth user experience. By allowing saves at any stage but controlling publishing through validation, we protect end-users from incomplete forms while giving editors the flexibility to work iteratively.

The progressive disclosure of validation issues and contextual guidance helps users understand and resolve problems quickly, reducing frustration and support burden.