# Error Handling Actual Implementation Plan

This document maps EXACTLY where error handling needs to be implemented in the current codebase, based on actual code that exists today. Each location is mapped to specific solutions from our error handling system.

## Summary of Current State

### What We Have
- ✅ Custom error classes (`AppError`, `AuthError`, `PermissionError`, etc.) in `/src/lib/utils/errors.ts`
- ✅ Error boundary component in `/src/components/error-boundary.tsx`
- ✅ `handleError` and `isAppError` utility functions

### What's Missing
- ❌ No consistent error middleware for server functions
- ❌ No centralized error handling for mutations/queries
- ❌ Toast.error() called directly everywhere (22+ locations)
- ❌ Generic `Error` thrown instead of typed errors (34+ locations)
- ❌ No error recovery actions
- ❌ No form validation error display components

## Implementation by Location

### PART 1: Server Functions (High Priority)

#### 1.1 Todos Server Functions
**File**: `/src/features/todos/lib/todos.server.ts`

**Current Issues**:
- Lines 77, 111, 119, 155, 192, 217: Uses `AppError` but no request tracking
- No Zod validation error transformation
- No centralized logging

**Implementation**:
```typescript
// Line 1-10: Add imports
import { createServerFn } from '@/lib/errors/middleware'; // New wrapper
import { ApiError } from '@/lib/errors/api-error'; // Replace AppError

// Line 77: Replace
// OLD: throw new AppError('Todo not found', 'Todo not found or access denied', 404)
// NEW:
throw ApiError.notFound('Todo');

// Line 90: Add Zod error handling in validator
.validator((data) => {
  try {
    return createTodoSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fields: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!fields[path]) fields[path] = [];
        fields[path].push(err.message);
      });
      throw ApiError.validation(fields);
    }
    throw error;
  }
})
```

#### 1.2 Todos Table Server Functions
**File**: `/src/features/todos/lib/todos-table.server.ts`

**Current Issues**:
- Lines 30, 164, 244, 331, 357: Generic `throw new Error('No organization ID in context')`

**Implementation**:
```typescript
// Replace all instances:
// OLD: throw new Error('No organization ID in context')
// NEW:
throw new ApiError('VAL_REQUIRED_FIELD', 400, { field: 'organizationId' }, 'Organization must be selected');
```

#### 1.3 Billing Server Functions
**File**: `/src/features/billing/lib/billing.server.ts`

**Current Issues**:
- Lines 23-40: Try/catch without proper error transformation
- Lines 97-120: Stripe errors not transformed
- Lines 144-166: Portal errors not handled

**Implementation**:
```typescript
// Line 23: Replace
// OLD: throw new Error('Organization not found')
// NEW:
throw ApiError.notFound('Organization');

// Lines 97-120: Stripe error transformation
catch (error) {
  if (error.type === 'StripeCardError') {
    throw new ApiError('BIZ_PAYMENT_FAILED', 400, error, 'Payment failed. Please check your card details');
  }
  if (error.type === 'StripeRateLimitError') {
    throw new ApiError('SYS_RATE_LIMIT', 429, error, 'Too many requests. Please try again later');
  }
  throw new ApiError('SYS_SERVER_ERROR', 500, error, 'Payment processing failed');
}
```

#### 1.4 Team Server Functions
**File**: `/src/features/team/lib/team.server.ts`

**Current Issues**:
- Lines 218, 235, 249, 272, 294, 307, 329, 340: Generic errors

**Implementation**:
```typescript
// Line 218: Replace
// OLD: throw new Error('Organization not found')
// NEW:
throw ApiError.notFound('Organization');

// Line 235: Replace
// OLD: throw new Error('User already exists in organization')
// NEW:
throw new ApiError('BIZ_DUPLICATE_ENTRY', 409, { email }, 'User is already a member');

// Line 249: Replace
// OLD: throw new Error('Invitation not found')
// NEW:
throw ApiError.notFound('Invitation');
```

#### 1.5 Organization Server Functions
**File**: `/src/features/organization/lib/members.server.ts`

**Current Issues**:
- Lines 45, 79, 111: Generic access denied errors

**Implementation**:
```typescript
// Replace all instances:
// OLD: throw new Error('Access denied to organization')
// NEW:
throw ApiError.permission('access organization members');
```

**File**: `/src/features/organization/lib/onboarding.server.ts`

**Current Issues**:
- Lines 23, 49, 65, 103: Various error types

**Implementation**:
```typescript
// Line 23: Replace
// OLD: throw new Error('User not found')
// NEW:
throw new ApiError('AUTH_SESSION_EXPIRED');

// Line 49: Replace
// OLD: throw new Error('Organization not found')
// NEW:
throw ApiError.notFound('Organization');
```

### PART 2: API Routes

#### 2.1 Avatar Upload API
**File**: `/src/routes/api/avatars/upload.ts`

**Current Issues**:
- Lines 109-121: Manual error responses
- Line 110: Console.warn instead of proper logging

**Implementation**:
```typescript
// Wrap entire handler:
export const Route = createAPIRoute('/api/avatars/upload')
  .methods({
    POST: withErrorHandler(async ({ request }) => {
      // Validation
      if (!file) {
        throw new ApiError('VAL_REQUIRED_FIELD', 400, { field: 'file' }, 'No file provided');
      }
      
      if (file.size > MAX_FILE_SIZE) {
        throw new ApiError('VAL_INVALID_FORMAT', 400, 
          { maxSize: MAX_FILE_SIZE, actualSize: file.size },
          'File too large. Maximum size is 5MB'
        );
      }
      
      // ... rest of handler
    })
  });
```

#### 2.2 Stripe Webhook
**File**: `/src/routes/api/stripe/webhook.ts`

**Current Issues**:
- Line 83: Basic try/catch without webhook-specific handling

**Implementation**:
```typescript
// Add webhook error handler:
catch (error) {
  // Log but don't expose webhook errors
  console.error('[Stripe Webhook]', error);
  
  // Always return 200 to prevent retries for coding errors
  if (error.type === 'StripeSignatureVerificationError') {
    return new Response('Webhook signature invalid', { status: 400 });
  }
  
  // Return 200 to acknowledge receipt even if processing failed
  return new Response('Webhook received', { status: 200 });
}
```

### PART 3: React Components - Mutations

#### 3.1 Todos Table Page
**File**: `/src/features/todos/components/todos-table-page.tsx`

**Current Issues**:
- Lines 100, 113, 128, 159: try/catch with toast.error
- Line 73, 86, 101, 114, 129, 159: `error.userMessage || 'Failed to...'` pattern

**Implementation**:
```typescript
// Import error hooks
import { useSafeMutation } from '@/lib/errors/hooks';
import { DataTableError } from '@/components/data-table/data-table-error';

// Replace handleCreateTodo (lines 82-104):
const createMutation = useSafeMutation(
  () => createTodo({ data: { title: 'Untitled Todo', description: '', priority: 'medium' } }),
  {
    successMessage: 'Todo created! Opening editor...',
    onSuccess: (created) => {
      navigate({ to: `/todos/${created.id}/edit` });
    }
  }
);

const handleCreateTodo = React.useCallback(() => {
  if (!activeOrganizationId) {
    toast.error('Please select an organization');
    return;
  }
  createMutation.mutate();
}, [activeOrganizationId, createMutation]);

// Replace handleToggle (lines 107-118):
const toggleMutation = useSafeMutation(
  (id: string) => toggleTodo({ data: { id } }),
  {
    successMessage: 'Todo updated',
    onSuccess: () => refetch()
  }
);

// Add error state display (after line 543):
if (error && !isLoading) {
  return <DataTableError error={parseError(error)} onRetry={refetch} />;
}
```

#### 3.2 Team Page
**File**: `/src/routes/_authenticated/team.tsx`

**Current Issues**:
- Lines 113, 159, 199, 216, 235: try/catch with toast.error
- Line 94: Manual validation with toast.error

**Implementation**:
```typescript
// Import error hooks
import { useSafeMutation } from '@/lib/errors/hooks';
import { FormFieldError } from '@/components/form/form-field-error';

// Replace sendInvitation (lines 91-115):
const inviteMutation = useSafeMutation(
  (email: string) => {
    if (!email) {
      throw new ApiError('VAL_REQUIRED_FIELD', 400, { field: 'email' }, 'Please enter an email address');
    }
    return sendInvitation({ data: { email, role: 'member' } });
  },
  {
    successMessage: 'Invitation sent!',
    onSuccess: () => {
      setInviteEmail('');
      loadMembers();
    }
  }
);

// In the form (line 253):
<FormFieldError name="email" error={inviteMutation.error} />
```

#### 3.3 Profile Page
**File**: `/src/routes/_authenticated/profile.tsx`

**Current Issues**:
- Lines 86-87: try/catch with console.error and toast.error

**Implementation**:
```typescript
// Replace updateProfile (lines 83-88):
const updateMutation = useSafeMutation(
  (values) => updateUser({ data: values }),
  {
    successMessage: 'Profile updated successfully',
    errorMessage: 'Failed to update profile'
  }
);

// In form:
<form onSubmit={handleSubmit((values) => updateMutation.mutate(values))}>
  <FormErrorSummary error={updateMutation.error} />
  {/* ... fields ... */}
</form>
```

#### 3.4 Organization Switcher
**File**: `/src/features/organization/components/organization-switcher.tsx`

**Current Issues**:
- Lines 86-96: Manual validation in try/catch
- Lines 103-108: toast.error with validation

**Implementation**:
```typescript
// Replace handleCreateOrganization:
const createOrgMutation = useSafeMutation(
  async (name: string) => {
    // Validation done by Zod in server function
    const result = await createOrganization({ data: { name } });
    await loadOrganizations();
    return result;
  },
  {
    successMessage: (org) => `Created ${org.name}`,
    onSuccess: (org) => {
      handleOrganizationChange(org.id);
      setIsCreating(false);
      setNewOrgName('');
    }
  }
);

// In form:
<FormField name="name" error={createOrgMutation.error}>
  <Input
    value={newOrgName}
    onChange={(e) => setNewOrgName(e.target.value)}
    placeholder="Organization name"
  />
</FormField>
<FormFieldError name="name" error={createOrgMutation.error} />
```

### PART 4: React Components - Queries

#### 4.1 Billing Page
**File**: `/src/features/billing/components/billing-page.tsx`

**Current Issues**:
- Lines 22, 51: useQuery without error handling
- Line 118: Manual error display

**Implementation**:
```typescript
// Add error handling to queries:
const { data: subscription, error: subError, isLoading: subLoading } = useQuery({
  queryKey: ['subscription', activeOrganizationId],
  queryFn: () => getSubscription(),
  enabled: !!activeOrganizationId,
});

// Replace error display (line 118):
if (subError) {
  return <PageError error={parseError(subError)} />;
}
```

#### 4.2 Admin Workspaces
**File**: `/src/routes/_authenticated/superadmin/workspaces.tsx`

**Current Issues**:
- Line 38: useQuery without error handling
- Lines 63-64: try/catch with toast.error

**Implementation**:
```typescript
// Add to query:
const { data: workspaces, error, isLoading, refetch } = useQuery({
  queryKey: ['admin', 'workspaces'],
  queryFn: () => getWorkspaces(),
});

// Add error display:
if (error) {
  return <DataTableError error={parseError(error)} onRetry={refetch} />;
}

// Replace deleteWorkspace:
const deleteMutation = useSafeMutation(
  (id: string) => deleteWorkspace({ data: { workspaceId: id } }),
  {
    successMessage: 'Workspace deleted',
    onSuccess: () => refetch()
  }
);
```

### PART 5: Form Components

#### 5.1 Todo Edit Form
**File**: `/src/routes/_authenticated/todos.$id.edit.tsx`

**Current Issues**:
- Lines 67-72: Form validation in try/catch
- Lines 183-210: Save operation with validation

**Implementation**:
```typescript
// Add form error handling:
const saveMutation = useSafeMutation(
  (values) => updateTodo({ data: { id: params.id, ...values } }),
  {
    successMessage: 'Todo saved',
    onSuccess: () => navigate({ to: '/todos' })
  }
);

// In form:
<form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
  <FormErrorSummary error={saveMutation.error} />
  
  <FormField name="title" label="Title" error={saveMutation.error} required>
    <Input {...register('title')} />
  </FormField>
  
  <FormField name="description" label="Description" error={saveMutation.error}>
    <Textarea {...register('description')} />
  </FormField>
  
  {/* ... other fields ... */}
</form>
```

#### 5.2 Avatar Upload Dialog
**File**: `/src/components/avatar-upload-dialog.tsx`

**Current Issues**:
- Lines 88-96: File validation with toast.error
- Lines 168-192: Upload operation with multiple error points

**Implementation**:
```typescript
// Add file validation errors:
const validateFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    throw new ApiError('VAL_INVALID_FORMAT', 400, 
      { type: file.type }, 
      'Please select an image file'
    );
  }
  
  if (file.size > 5 * 1024 * 1024) {
    throw new ApiError('VAL_INVALID_FORMAT', 400,
      { size: file.size, max: 5 * 1024 * 1024 },
      'Image must be less than 5MB'
    );
  }
};

// Use mutation for upload:
const uploadMutation = useSafeMutation(
  async (file: File) => {
    validateFile(file);
    // ... upload logic
  },
  {
    successMessage: 'Avatar uploaded successfully',
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
    }
  }
);
```

#### 5.3 Onboarding Form
**File**: `/src/features/auth/components/onboarding-form.tsx`

**Current Issues**:
- Line 38: try/catch in form submission

**Implementation**:
```typescript
const onboardingMutation = useSafeMutation(
  (values) => updateOnboarding({ data: values }),
  {
    successMessage: 'Profile updated',
    onSuccess: () => {
      router.push('/');
    }
  }
);

// In form:
<form onSubmit={handleSubmit((values) => onboardingMutation.mutate(values))}>
  <FormErrorSummary error={onboardingMutation.error} />
  {/* ... fields with FormFieldError ... */}
</form>
```

### PART 6: Auth Components

#### 6.1 Magic Link Sign In
**File**: `/src/features/auth/components/magic-link-sign-in.tsx`

**Current Issues**:
- Line 20: try/catch in auth operation

**Implementation**:
```typescript
const magicLinkMutation = useSafeMutation(
  (email: string) => auth.signIn.magicLink({ email }),
  {
    successMessage: 'Check your email for the magic link',
    errorMessage: (error) => {
      if (error.code === 'SYS_RATE_LIMIT') {
        return 'Too many attempts. Please try again later';
      }
      return error.message;
    }
  }
);
```

#### 6.2 OTP Sign In
**File**: `/src/features/auth/components/otp-sign-in.tsx`

**Current Issues**:
- Lines 20, 40: try/catch in OTP flow

**Implementation**:
```typescript
const sendOtpMutation = useSafeMutation(
  (email: string) => auth.signIn.emailOtp({ email, type: 'sign-in' }),
  {
    successMessage: 'Verification code sent',
    onSuccess: () => setStep('verify')
  }
);

const verifyOtpMutation = useSafeMutation(
  (otp: string) => auth.signIn.emailOtp({ email, otp }),
  {
    successMessage: 'Signed in successfully',
    errorMessage: (error) => {
      if (error.code === 'AUTH_INVALID_CREDENTIALS') {
        return 'Invalid verification code';
      }
      return error.message;
    }
  }
);
```

### PART 7: Middleware

#### 7.1 Auth Middleware
**File**: `/src/lib/auth/auth-middleware.ts`

**Current Issues**:
- Line 17: Generic error throw

**Implementation**:
```typescript
// Replace:
// OLD: throw new Error('Unauthorized')
// NEW:
throw new ApiError('AUTH_SESSION_EXPIRED', 401, null, 'Please sign in to continue');
```

#### 7.2 Organization Middleware
**File**: `/src/features/organization/lib/organization-middleware.ts`

**Current Issues**:
- Lines 48-49: Silent error swallowing

**Implementation**:
```typescript
// Line 48-49: Add logging
catch (error) {
  console.error('[Organization Middleware] Validation failed:', error);
  // Don't throw - just clear the organization
  validatedOrgId = null;
}
```

#### 7.3 Billing Middleware
**File**: `/src/features/billing/lib/billing-middleware.ts`

**Current Issues**:
- Line 30: Generic error

**Implementation**:
```typescript
// Replace:
// OLD: throw new Error('No active organization selected')
// NEW:
throw new ApiError('VAL_REQUIRED_FIELD', 400, { field: 'organizationId' }, 'Please select an organization');
```

### PART 8: Utilities

#### 8.1 Permissions
**File**: `/src/lib/utils/permissions.ts`

**Current Issues**:
- Line 36: PermissionError thrown but not logged

**Implementation**:
```typescript
// Add logging before throwing:
if (!hasPermission.success) {
  console.error('[Permission Check Failed]', {
    resource,
    actions,
    organizationId,
    userId: session?.user?.id
  });
  
  const defaultMessage = `You don't have permission to ${actions.join('/')} ${resource}`;
  throw new PermissionError(customMessage || defaultMessage);
}
```

#### 8.2 Database Connection
**File**: `/src/lib/db/db.ts`

**Current Issues**:
- Line 7: Generic error for missing env var

**Implementation**:
```typescript
// Replace:
// OLD: throw new Error('DATABASE_URL environment variable is required')
// NEW:
throw new ApiError('SYS_CONFIG_ERROR', 500, 
  { variable: 'DATABASE_URL' },
  'Database configuration error'
);
```

### PART 9: Hooks

#### 9.1 Form Autosave Hook
**File**: `/src/lib/hooks/use-form-autosave.tsx`

**Current Issues**:
- Lines 88-97: try/catch with toast.error

**Implementation**:
```typescript
// Replace error handling:
catch (error) {
  const parsed = parseError(error);
  setError(parsed.message);
  
  // Only show toast for non-transient errors
  if (!parsed.code.startsWith('NET_')) {
    toast.error(parsed.message);
  }
  
  throw error; // Re-throw for caller to handle
}
```

#### 9.2 Permissions Hook
**File**: `/src/lib/hooks/use-permissions.ts`

**Current Issues**:
- Lines 35-37: Console.error without structured logging

**Implementation**:
```typescript
// Enhanced error logging:
catch (error) {
  const parsed = parseError(error);
  console.error('[Permissions Hook]', {
    error: parsed,
    resource,
    actions,
    context: { organizationId }
  });
  return { success: false, error: parsed };
}
```

## Files That Need New Error Components

### Required Components to Create

1. **`src/lib/errors/api-error.ts`** - Enhanced ApiError class
2. **`src/lib/errors/middleware.ts`** - Server function wrapper
3. **`src/lib/errors/client.ts`** - Client error handler
4. **`src/lib/errors/hooks.ts`** - React error hooks
5. **`src/components/form/form-field-error.tsx`** - Field error display
6. **`src/components/form/form-error-summary.tsx`** - Form error summary
7. **`src/components/data-table/data-table-error.tsx`** - Table error state
8. **`src/components/page/page-error.tsx`** - Page-level errors

## Implementation Priority

### Phase 1: Core Infrastructure (Day 1)
1. Create error system files (8 new files)
2. Update QueryClient configuration
3. Create createServerFn wrapper

### Phase 2: Server Functions (Day 2)
1. Update all 6 server function files
2. Add error middleware to all createServerFn calls
3. Replace generic errors with ApiError

### Phase 3: Critical Components (Day 3)
1. Update todos-table-page.tsx (most complex)
2. Update team.tsx (member management)
3. Update billing-page.tsx (payment critical)

### Phase 4: Forms & Auth (Day 4)
1. Update all form components
2. Update auth components
3. Add form error display components

### Phase 5: Remaining Components (Day 5)
1. Update admin components
2. Update remaining pages
3. Update utility functions

## What We're NOT Implementing (Yet)

Based on the current codebase analysis, these items from the original plan are NOT needed immediately:

1. **i18n message keys** - No i18n system in place
2. **Offline handling** - No offline requirements visible
3. **Error analytics dashboard** - No analytics infrastructure
4. **A/B testing** - No testing framework
5. **Cross-tab sync** - No multi-tab requirements
6. **Progressive disclosure** - Can add later if needed
7. **Animations** - Not critical for MVP
8. **Circuit breakers** - Advanced pattern not needed yet

## Success Metrics

After implementation:
- ✅ 0 instances of `toast.error()` called directly
- ✅ 0 instances of generic `throw new Error()`
- ✅ All server functions use ApiError
- ✅ All mutations use useSafeMutation
- ✅ All tables show error states
- ✅ All forms show validation errors
- ✅ Request IDs in all server errors

## Next Steps

1. Create the 8 new error system files
2. Update files in priority order
3. Test each component after updating
4. Remove old error handling patterns
5. Document new patterns for team