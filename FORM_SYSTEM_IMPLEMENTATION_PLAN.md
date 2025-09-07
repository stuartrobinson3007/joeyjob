# Form System Implementation Plan

## Executive Summary

This document outlines the implementation plan for a robust, type-safe form system using React Hook Form, Zod validation, TanStack Query, and TanStack Start. The system will provide seamless error propagation from backend to frontend, with proper field-level error handling and async validation capabilities.

## Goals

1. **Type-Safe Forms**: End-to-end type safety using Zod schemas
2. **Error Propagation**: Backend validation errors automatically map to form fields
3. **Async Validation**: Real-time validation with debounced backend checks
4. **Reusable Patterns**: Components and hooks that serve as boilerplate for future projects
5. **Developer Experience**: Simple, consistent API across all forms

## Current State Analysis

### Existing Infrastructure
- **React Hook Form**: v7.62.0 installed with basic form components
- **Zod**: Used for server-side validation
- **Error System**: AppError class with ValidationError for field-level errors
- **Database**: Unique constraints (e.g., organization slug)
- **Better Auth**: Handles organization management

### Identified Issues
1. Settings form doesn't sync with async-loaded organization data
2. No backend error propagation to form fields
3. No async field validation (e.g., checking slug availability)
4. Inconsistent form patterns across the application
5. Better Auth integration needs custom validation layer

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
├─────────────────────────────────────────────────────────┤
│  Form Component                                          │
│  ├── React Hook Form (form state management)            │
│  ├── Zod Schema (client validation)                     │
│  ├── Async Validators (debounced backend checks)        │
│  └── Error Display (field-level messages)               │
├─────────────────────────────────────────────────────────┤
│  Integration Layer                                       │
│  ├── useFormMutation (error mapping)                    │
│  ├── Better Auth Wrapper (custom validation)            │
│  ├── TanStack Query (server state)                      │
│  └── Error Transformation (ValidationError → fields)    │
├─────────────────────────────────────────────────────────┤
│                    Backend (TanStack Start)              │
├─────────────────────────────────────────────────────────┤
│  Server Functions                                        │
│  ├── Zod Validation (same schema as frontend)          │
│  ├── Business Logic Validation                         │
│  ├── Database Constraints                              │
│  └── ValidationError with field mapping                │
└─────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Validation Schema Library & Registry
**Location**: `src/lib/validation/`

```typescript
// validation-registry.ts
import { z } from 'zod'

// Single source of truth for all validations
export const validationRules = {
  organization: {
    name: z.string()
      .min(2, 'Organization name must be at least 2 characters')
      .max(100, 'Organization name must be less than 100 characters'),
    slug: z.string()
      .min(3, 'Slug must be at least 3 characters')
      .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
      .max(50, 'Slug must be less than 50 characters')
  },
  user: {
    email: z.string().email('Invalid email address'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required')
  }
}

// Create schemas from rules
export const organizationSchema = z.object({
  name: validationRules.organization.name,
  slug: validationRules.organization.slug
})

// Database constraint validator
export async function validateDatabaseConstraints(
  entity: 'organization' | 'user',
  field: string,
  value: any,
  context?: any
): Promise<true | string> {
  switch (entity) {
    case 'organization':
      if (field === 'slug') {
        const existing = await db.select()
          .from(organization)
          .where(and(
            eq(organization.slug, value),
            context?.excludeId ? not(eq(organization.id, context.excludeId)) : undefined
          ))
        
        if (existing.length > 0) {
          return 'This slug is already taken'
        }
      }
      break
  }
  return true
}

// Unified validation function
export async function validateField(
  entity: string,
  field: string,
  value: any,
  options?: { skipDatabase?: boolean; context?: any }
): Promise<{ valid: boolean; error?: string }> {
  try {
    // 1. Zod validation
    const schema = validationRules[entity]?.[field]
    if (schema) {
      await schema.parseAsync(value)
    }
    
    // 2. Database validation
    if (!options?.skipDatabase) {
      const dbResult = await validateDatabaseConstraints(
        entity, field, value, options?.context
      )
      if (dbResult !== true) {
        return { valid: false, error: dbResult }
      }
    }
    
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        valid: false, 
        error: error.errors[0]?.message || 'Validation failed' 
      }
    }
    return { valid: false, error: 'Validation failed' }
  }
}
```

**Files to create**:
- `src/lib/validation/index.ts` - Export all schemas
- `src/lib/validation/validation-registry.ts` - Central validation logic
- `src/lib/validation/organization.schema.ts`
- `src/lib/validation/user.schema.ts`
- `src/lib/validation/todo.schema.ts`

#### 1.2 Server Functions with Validation
**Location**: `src/features/organization/lib/organization.server.ts`

**Key Features**:
- Zod validation at the server level
- Business logic validation (e.g., unique slug)
- Proper error throwing with field mapping

**Tasks**:
- [ ] Create updateOrganization server function
- [ ] Create checkSlugAvailability server function
- [ ] Add proper ValidationError throwing
- [ ] Test error propagation

### Phase 1.5: Better Auth Integration Strategy

#### Better Auth Wrapper Layer
**Location**: `src/lib/auth/organization-wrapper.ts`

**Purpose**: Intercept Better Auth calls to add custom validation and error transformation

```typescript
import { authClient } from '@/lib/auth/auth-client'
import { ValidationError, AppError } from '@/lib/utils/errors'
import { validateField } from '@/lib/validation/validation-registry'

export async function updateOrganizationWithValidation(data: {
  organizationId: string
  name: string
  slug: string
}) {
  // 1. Run our custom validations first
  const slugValidation = await validateField(
    'organization', 
    'slug', 
    data.slug,
    { context: { excludeId: data.organizationId } }
  )
  
  if (!slugValidation.valid) {
    throw new ValidationError({
      slug: slugValidation.error
    })
  }
  
  // 2. Call Better Auth
  const result = await authClient.organization.update({
    organizationId: data.organizationId,
    data: { name: data.name, slug: data.slug }
  })
  
  // 3. Transform Better Auth errors to our format
  if (result.error) {
    // Check if Better Auth provides field information
    if (result.error.field) {
      throw new ValidationError({
        [result.error.field]: result.error.message
      })
    }
    // Otherwise throw as general error
    throw new AppError(
      'BIZ_UPDATE_FAILED', 
      400, 
      undefined, 
      result.error.message || 'Failed to update organization'
    )
  }
  
  return result.data
}

// Similar wrappers for create, delete, etc.
export async function createOrganizationWithValidation(data: {
  name: string
  slug: string
}) {
  // Validate before calling Better Auth
  const validation = await validateField('organization', 'slug', data.slug)
  if (!validation.valid) {
    throw new ValidationError({ slug: validation.error })
  }
  
  const result = await authClient.organization.create({ data })
  if (result.error) {
    throw transformBetterAuthError(result.error)
  }
  
  return result.data
}

function transformBetterAuthError(error: any): Error {
  // Transform Better Auth errors to our AppError format
  if (error.field) {
    return new ValidationError({ [error.field]: error.message })
  }
  return new AppError('BIZ_OPERATION_FAILED', 400, undefined, error.message)
}
```

### Phase 2: Form Hook Integration (Week 1-2)

#### 2.1 Form Mutation Hook
**Location**: `src/lib/hooks/use-form-mutation.ts`

**Purpose**: Bridge between TanStack Query mutations and React Hook Form error handling

**Features**:
- Automatic error field mapping
- Root-level error handling
- Type-safe error setting
- Toast notifications for general errors

**Complete Implementation with Type Safety**:
```typescript
import { useMutation } from '@tanstack/react-query'
import { UseFormSetError, FieldValues, Path } from 'react-hook-form'
import { toast } from 'sonner'
import { ValidationError } from '@/lib/utils/errors'
import { parseError } from '@/lib/errors/client-handler'
import { getErrorDisplayType } from '@/lib/errors/error-categories'

interface UseFormMutationOptions<
  TData,
  TVariables,
  TFieldValues extends FieldValues
> {
  mutationFn: (variables: TVariables) => Promise<TData>
  setError: UseFormSetError<TFieldValues>
  onSuccess?: (data: TData) => void
  onError?: (error: unknown) => void
  showToast?: boolean
}

export function useFormMutation<
  TData = unknown,
  TVariables = unknown,
  TFieldValues extends FieldValues = FieldValues
>({
  mutationFn,
  setError,
  onSuccess,
  onError,
  showToast = true
}: UseFormMutationOptions<TData, TVariables, TFieldValues>) {
  return useMutation({
    mutationFn,
    onSuccess,
    onError: (error) => {
      const parsed = parseError(error)
      
      // SCENARIO 1: Backend field-level validation errors
      if (error instanceof ValidationError && error.context?.fields) {
        Object.entries(error.context.fields).forEach(([field, message]) => {
          const fieldPath = field as Path<TFieldValues>
          setError(fieldPath, {
            type: 'server',
            message: Array.isArray(message) ? message[0] : message
          })
        })
      } 
      // SCENARIO 2: General errors - route based on error type
      else {
        const displayType = getErrorDisplayType(parsed.code)
        
        switch (displayType) {
          case 'field':
            // Shouldn't happen without fields, but handle gracefully
            setError('root' as Path<TFieldValues>, {
              type: 'server',
              message: parsed.message
            })
            break
            
          case 'form':
            // Show in form error area
            setError('root' as Path<TFieldValues>, {
              type: 'server',
              message: parsed.message
            })
            break
            
          case 'toast':
            // Show as toast notification
            if (showToast) {
              toast.error(parsed.message, {
                description: 'Please try again or contact support if the issue persists.'
              })
            }
            break
        }
      }
      
      // Always call custom error handler if provided
      onError?.(error)
    }
  })
}
```

**Error Routing Protocol**:
- **Field errors** → `setError(fieldName, ...)` → Shows under field
- **Form errors** → `setError('root', ...)` → Shows in form error area
- **System errors** → `toast.error(...)` → Shows as toast notification

#### 2.2 Error Categorization System
**Location**: `src/lib/errors/error-categories.ts`

**Purpose**: Determine where errors should be displayed based on error codes

```typescript
import { ERROR_CODES } from './codes'

const ERROR_CATEGORIES = {
  field: new Set([
    ERROR_CODES.VAL_REQUIRED_FIELD,
    ERROR_CODES.VAL_INVALID_FORMAT,
    ERROR_CODES.VAL_INVALID_EMAIL,
    ERROR_CODES.BIZ_DUPLICATE_ENTRY
  ]),
  form: new Set([
    ERROR_CODES.BIZ_LIMIT_EXCEEDED,
    ERROR_CODES.BIZ_INVALID_STATE,
    ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
    ERROR_CODES.BIZ_PAYMENT_FAILED
  ]),
  toast: new Set([
    ERROR_CODES.SYS_SERVER_ERROR,
    ERROR_CODES.NET_CONNECTION_ERROR,
    ERROR_CODES.NET_TIMEOUT,
    ERROR_CODES.SYS_RATE_LIMIT,
    ERROR_CODES.AUTH_SESSION_EXPIRED
  ])
}

export function getErrorDisplayType(code: string): 'field' | 'form' | 'toast' {
  if (ERROR_CATEGORIES.field.has(code)) return 'field'
  if (ERROR_CATEGORIES.form.has(code)) return 'form'
  if (ERROR_CATEGORIES.toast.has(code)) return 'toast'
  return 'toast' // Default to toast for unknown errors
}
```

#### 2.3 Async Field Validation Hook with Race Condition Prevention
**Location**: `src/lib/hooks/use-async-field-validator.ts`

**Features**:
- Debounced validation
- Request cancellation with AbortController
- Race condition prevention
- Loading states
- Error handling

```typescript
import { useCallback, useRef, useEffect } from 'react'

export function useAsyncFieldValidator<T>(
  validationFn: (value: T, signal?: AbortSignal) => Promise<boolean | string>,
  deps: any[] = []
) {
  const abortControllerRef = useRef<AbortController>()
  
  const validate = useCallback(async (value: T) => {
    // Cancel any in-flight validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new controller for this validation
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    
    try {
      const result = await validationFn(value, signal)
      
      // Check if this validation was cancelled
      if (signal.aborted) {
        return true // Return valid if cancelled (don't show stale errors)
      }
      
      return result
    } catch (error) {
      // Handle abort errors gracefully
      if (error.name === 'AbortError') {
        return true // Valid if aborted
      }
      
      // Log unexpected errors
      console.error('Async validation error:', error)
      return 'Validation failed. Please try again.'
    }
  }, deps)
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  return validate
}

// Usage example with React Hook Form:
const validateSlug = useAsyncFieldValidator(
  async (slug: string, signal?: AbortSignal) => {
    // Skip if unchanged from original
    if (slug === originalSlug) return true
    
    const response = await fetch('/api/check-slug', {
      method: 'POST',
      body: JSON.stringify({ slug, organizationId }),
      signal // Pass signal to fetch for cancellation
    })
    
    if (!response.ok) throw new Error('Network error')
    
    const data = await response.json()
    return data.available || 'This slug is already taken'
  },
  [organizationId, originalSlug]
)
```

#### 2.4 Form Data Sync Hook
**Location**: `src/lib/hooks/use-form-sync.ts`

**Purpose**: Sync form with async-loaded data

```typescript
import { useEffect } from 'react'
import { UseFormReset } from 'react-hook-form'

export function useFormSync<T>(
  form: { reset: UseFormReset<T> },
  data: T | null | undefined,
  dependencies: any[] = []
) {
  useEffect(() => {
    if (data) {
      form.reset(data)
    }
  }, [data, ...dependencies])
}
```

### Phase 3: Component Library (Week 2)

#### 3.1 Form Error Boundary
**Location**: `src/components/form/form-error-boundary.tsx`

```typescript
import { ErrorBoundary } from '@/components/error-boundary'
import { toast } from 'sonner'
import { Button } from '@/components/taali-ui/ui/button'

interface FormErrorBoundaryProps {
  children: React.ReactNode
  onError?: (error: Error) => void
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
}

export function FormErrorBoundary({ 
  children, 
  onError,
  fallback: FallbackComponent 
}: FormErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error('Form rendering error:', error)
        
        // Show toast for render errors
        toast.error('Form failed to load', {
          description: 'Please refresh the page and try again'
        })
        
        onError?.(error)
      }}
      fallback={FallbackComponent || FormErrorFallback}
    >
      {children}
    </ErrorBoundary>
  )
}

function FormErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-4 border border-destructive rounded-lg">
      <h3 className="font-semibold text-destructive">Form Error</h3>
      <p className="text-sm text-muted-foreground mt-2">
        The form encountered an error and cannot be displayed.
      </p>
      <Button onClick={reset} className="mt-4" variant="outline">
        Try Again
      </Button>
    </div>
  )
}
```

#### 3.2 Form Field Components
**Location**: `src/components/form/`

**Components to create**:
- `TextField.tsx` - Text input with validation
- `TextareaField.tsx` - Textarea with validation
- `SelectField.tsx` - Select dropdown
- `CheckboxField.tsx` - Checkbox with label
- `RadioGroupField.tsx` - Radio button group
- `DatePickerField.tsx` - Date selection
- `FileUploadField.tsx` - File upload with preview

Example TextField:
```typescript
import { Control, FieldPath, FieldValues } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/taali-ui/ui/form'
import { Input } from '@/components/taali-ui/ui/input'

interface TextFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  placeholder?: string
  description?: string
  rules?: any
}

export function TextField<TFieldValues extends FieldValues>({ 
  control, 
  name, 
  label, 
  placeholder, 
  description, 
  rules 
}: TextFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} placeholder={placeholder} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

#### 3.3 Form Layout Components
- `FormSection.tsx` - Group related fields
- `FormActions.tsx` - Submit/Cancel buttons
- `FormError.tsx` - Root-level error display
- `FormSuccess.tsx` - Success message display

### Phase 4: Settings Form Implementation (Week 2-3)

#### 4.1 Refactor Settings Page
**Location**: `src/routes/_authenticated/settings.tsx`

**Implementation Steps**:
1. Replace useState with useForm
2. Add zodResolver for validation
3. Implement useFormSync for data loading
4. Add async slug validation
5. Implement useFormMutation for submission
6. Add proper error display
7. Wrap in FormErrorBoundary

Complete Implementation:
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { organizationSchema, type OrganizationFormData } from '@/lib/validation/organization.schema'
import { updateOrganizationWithValidation } from '@/lib/auth/organization-wrapper'
import { useFormMutation } from '@/lib/hooks/use-form-mutation'
import { useAsyncFieldValidator } from '@/lib/hooks/use-async-field-validator'
import { useFormSync } from '@/lib/hooks/use-form-sync'
import { FormErrorBoundary } from '@/components/form/form-error-boundary'
import { Form } from '@/components/taali-ui/ui/form'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/taali-ui/ui/button'
import { Alert, AlertDescription } from '@/components/taali-ui/ui/alert'

function OrganizationSettingsForm() {
  const { activeOrganization, isLoading } = useActiveOrganization()
  const { showSuccess } = useErrorHandler()
  
  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      slug: ''
    },
    mode: 'onChange' // Enable real-time validation
  })
  
  // Sync form with loaded organization data
  useFormSync(form, activeOrganization, [activeOrganization])
  
  // Setup async slug validation
  const validateSlug = useAsyncFieldValidator(
    async (slug: string, signal?: AbortSignal) => {
      if (!activeOrganization || slug === activeOrganization.slug) {
        return true
      }
      
      const result = await checkSlugAvailability({ 
        slug, 
        organizationId: activeOrganization.id 
      })
      
      return result.available || 'This slug is already taken'
    },
    [activeOrganization]
  )
  
  // Setup mutation with error handling
  const updateMutation = useFormMutation<
    any,
    OrganizationFormData,
    OrganizationFormData
  >({
    mutationFn: async (data) => {
      if (!activeOrganization) throw new Error('No organization')
      return updateOrganizationWithValidation({
        ...data,
        organizationId: activeOrganization.id
      })
    },
    setError: form.setError,
    onSuccess: () => {
      showSuccess('Organization updated successfully')
    }
  })
  
  const onSubmit = (data: OrganizationFormData) => {
    updateMutation.mutate(data)
  }
  
  if (isLoading) {
    return <LoadingSpinner />
  }
  
  if (!activeOrganization) {
    return <NoOrganizationMessage />
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <TextField
          control={form.control}
          name="name"
          label="Organization Name"
          placeholder="Enter organization name"
        />
        
        <TextField
          control={form.control}
          name="slug"
          label="Organization Slug"
          placeholder="organization-slug"
          description="Used in URLs and must be unique"
          rules={{
            validate: validateSlug
          }}
        />
        
        {form.formState.errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
          </Alert>
        )}
        
        <Button 
          type="submit" 
          disabled={updateMutation.isPending || !form.formState.isDirty}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </Form>
  )
}

// Export wrapped component
export function OrganizationSettings() {
  return (
    <FormErrorBoundary>
      <OrganizationSettingsForm />
    </FormErrorBoundary>
  )
}
```

#### 4.2 Testing Strategy
- [ ] Test form validation (client-side)
- [ ] Test async validation (slug availability)
- [ ] Test error propagation from backend
- [ ] Test data syncing with async load
- [ ] Test form submission success/failure
- [ ] Test error boundary recovery

### Phase 5: Migration Strategy (Week 3-4)

#### 5.1 Form Audit
**Identify all forms in the application**:
- [ ] List all components using forms
- [ ] Categorize by complexity
- [ ] Prioritize migration order

#### 5.2 Migration Guide
**Create documentation**:
- Step-by-step migration instructions
- Common patterns and solutions
- Troubleshooting guide

#### 5.3 Progressive Migration
**Order of migration**:
1. Settings form (pilot implementation)
2. Simple forms (login, profile)
3. Complex forms (todos, multi-step)
4. Dynamic forms (generated from schema)

### Phase 6: Advanced Features (Week 4+)

#### 6.1 Form State Persistence
- LocalStorage/SessionStorage integration
- Auto-save functionality
- Draft management

#### 6.2 Multi-Step Forms
- Step validation
- Progress tracking
- Data preservation between steps

#### 6.3 Dynamic Forms
- Schema-driven form generation
- Conditional fields
- Array fields management

#### 6.4 Optimistic Updates
- Immediate UI feedback
- Rollback on error
- Cache management

## Error Handling Strategy

### Complete Error Flow Diagram

```
CLIENT-SIDE VALIDATION (Zod)
├── Field passes → Continue
└── Field fails → setError(fieldName) → Display under field

BACKEND VALIDATION
├── Success → onSuccess callback
└── Error Response
    ├── ValidationError with fields
    │   └── For each field error
    │       └── setError(fieldName, message) → Display under field
    ├── Business/Validation Error (no specific field)
    │   └── setError('root', message) → Display in form error area
    └── System/Network Error
        └── toast.error(message) → Display as toast notification
```

### Error Types & Display Locations

1. **Client-Side Field Errors (Zod)**
   - **Source**: Frontend validation via zodResolver
   - **Display**: Under the specific field via `<FormMessage />`
   - **Example**: "Slug must be at least 3 characters"
   - **Code**: Handled automatically by React Hook Form + Zod

2. **Backend Field-Specific Errors**
   - **Source**: Server validation returning ValidationError with fields
   - **Display**: Under the specific field via `<FormMessage />`
   - **Example**: "This slug is already taken"
   - **Protocol**:
     ```typescript
     // Backend throws:
     throw new ValidationError({
       slug: 'This slug is already taken',
       name: 'Organization name already exists'
     })
     // Frontend receives and maps to fields
     ```

3. **General Form Errors (Root Errors)**
   - **Source**: Business logic errors without specific field
   - **Display**: In form error area (top or bottom of form)
   - **Example**: "You've reached your organization limit"
   - **Protocol**:
     ```typescript
     // Shows in form via:
     setError('root', { message: 'You've reached your organization limit' })
     // Displayed via:
     {form.formState.errors.root && (
       <Alert variant="destructive">
         <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
       </Alert>
     )}
     ```

4. **System/Network Errors**
   - **Source**: Server errors, network failures
   - **Display**: Toast notification
   - **Example**: "Network error. Please try again."
   - **Protocol**:
     ```typescript
     toast.error('Network error. Please try again.', {
       description: 'Check your connection and retry'
     })
     ```

## Implementation Checklist

### Week 1
- [ ] Set up validation schema structure and registry
- [ ] Create Better Auth wrapper functions
- [ ] Create organization server functions
- [ ] Implement useFormMutation hook
- [ ] Implement useAsyncFieldValidator hook
- [ ] Implement error categorization system
- [ ] Create basic form components

### Week 2
- [ ] Create FormErrorBoundary component
- [ ] Refactor settings form
- [ ] Test error propagation
- [ ] Create form component library
- [ ] Document patterns

### Week 3
- [ ] Audit existing forms
- [ ] Create migration guide
- [ ] Begin progressive migration
- [ ] Add advanced validation patterns

### Week 4
- [ ] Complete form migrations
- [ ] Implement advanced features
- [ ] Performance optimization
- [ ] Final documentation

## Success Metrics

1. **Developer Experience**
   - Time to implement new form: < 30 minutes
   - Code reuse: > 80% for standard forms
   - Type safety: 100% coverage

2. **User Experience**
   - Form validation feedback: < 100ms
   - Async validation: < 500ms (debounced)
   - Error clarity: 100% actionable messages

3. **Code Quality**
   - Test coverage: > 90%
   - Bundle size increase: < 10KB
   - Performance impact: < 5% overhead

## Best Practices

### Do's
- ✅ Share Zod schemas between frontend and backend
- ✅ Use proper TypeScript types throughout
- ✅ Implement proper loading states
- ✅ Debounce async validations
- ✅ Provide clear, actionable error messages
- ✅ Test error scenarios thoroughly
- ✅ Use AbortController for async validation
- ✅ Wrap forms in error boundaries

### Don'ts
- ❌ Don't duplicate validation logic
- ❌ Don't ignore accessibility
- ❌ Don't skip error boundaries
- ❌ Don't forget loading states
- ❌ Don't use generic error messages
- ❌ Don't trust client-side validation alone

## Example Implementation

### Simple Form Pattern
```typescript
function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData
  })
  
  const mutation = useFormMutation<ResponseType, FormData, FormData>({
    mutationFn: serverFunction,
    setError: form.setError,
    onSuccess: handleSuccess
  })
  
  return (
    <FormErrorBoundary>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(mutation.mutate)}>
          <TextField name="field1" label="Field 1" control={form.control} />
          <Button type="submit" disabled={mutation.isPending}>
            Submit
          </Button>
        </form>
      </Form>
    </FormErrorBoundary>
  )
}
```

## Resources

### Documentation
- [React Hook Form Docs](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [TanStack Start Docs](https://tanstack.com/start/latest)
- [Better Auth Docs](https://www.better-auth.com/)

### Internal Documentation
- Form Component API Reference (to be created)
- Migration Guide (to be created)
- Testing Guide (to be created)

## Conclusion

This implementation plan provides a comprehensive approach to building a robust, type-safe form system that will serve as the foundation for all forms in the application. The phased approach ensures minimal disruption while progressively improving the codebase.

The key to success will be:
1. Maintaining type safety throughout
2. Creating reusable, well-documented components
3. Ensuring proper error handling at every level
4. Following the migration plan systematically
5. Properly integrating with Better Auth

This system will significantly improve both developer experience and user experience, while providing a solid foundation for future projects.