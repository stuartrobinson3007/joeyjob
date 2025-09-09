# Form Editor Migration Plan: joeyjob-old → joeyjob

## Executive Summary
This document outlines the comprehensive plan to migrate the form editor functionality from the legacy joeyjob-old repository (React Router + Supabase) to the new joeyjob repository (TanStack Start + PostgreSQL/Drizzle). The migration involves copying all form editor components, adapting them to use server functions instead of API clients, and implementing auto-save functionality.

## Current State Analysis

### joeyjob-old (Source)
- **Framework**: React with React Router
- **Backend**: Supabase with API client pattern
- **Form Editor**: Fully functional with drag-and-drop, multi-view navigation
- **Components**: 15+ specialized components for form building
- **State Management**: React Query with Supabase hooks
- **Features**: Service tree editor, 10+ field types, real-time preview

### joeyjob (Target)
- **Framework**: TanStack Start with file-based routing
- **Backend**: PostgreSQL with Drizzle ORM and server functions
- **Database Ready**: Tables for bookingForms, services, and bookings already exist
- **Auth**: Better Auth with organization middleware
- **Required**: Full feature parity with joeyjob-old using server functions

## Critical Framework Requirements (From Documentation Review)

### **File Naming Convention**
- **ALL component files MUST use kebab-case** (e.g., `this-case.tsx`, not `ThisCase.tsx`)
- This applies to all migrated components from joeyjob-old
- Hook files use kebab-case with `use-` prefix (e.g., `use-form-editor-state.tsx`)

### 1. **UI Component Standards** (docs/05-ui-component-library.md)
- **MUST use @/ui alias** for ALL UI component imports
- **NEVER use relative paths** for UI components
- **ALWAYS use cn() utility** for className merging
- **Copy old FormFieldRenderer** - The existing one in joeyjob is incorrect UI

### 2. **Form System Requirements** (docs/11-advanced-form-system.md)
- **MUST wrap forms with FormErrorBoundary** for error handling
- **ALWAYS use useFormMutation** for form submissions
- **Handle async validation** with proper abort signals and race conditions
- **Implement form sync patterns** for async-loaded data

### 3. **Multi-tenancy Compliance** (docs/04-multi-tenancy-implementation.md)
- **ALL data MUST be scoped by organizationId**
- **MUST use organizationMiddleware** in all server functions
- **Use sessionStorage** for organization context (tab-specific)
- **Validate organization membership** for all operations

### 4. **Validation Architecture** (docs/12-validation-architecture.md)
- **Use validation registry** to avoid duplication
- **Server-side validation is MANDATORY**
- **Use consistent validation messages** with i18n support
- **Handle database constraints** (uniqueness, etc.)

### 5. **Error Handling Standards** (docs/10-error-handling-workflow.md)
- **ALWAYS use AppError and ValidationError** classes
- **NEVER throw generic errors**
- **Include translation keys** for all user-facing errors
- **Use proper error boundaries** in UI

### 6. **Hook Patterns** (docs/14-advanced-hook-patterns.md)
- **Proper cleanup** in async validators
- **Use abort controllers** for race condition handling
- **Follow React Rules of Hooks**
- **Provider composition patterns**

### 7. **Server Function Patterns** (docs/06-server-functions-api-patterns.md)
- **ALWAYS use createServerFn** with proper method
- **Include middleware chain**: auth → organization → handler
- **Validate with Zod schemas**
- **Return consistent response formats**

## Architecture Alignment

### Database Schema (Already Exists)
```typescript
// bookingForms table
- id, organizationId, name, description
- formConfig (JSON) - stores serviceTree, baseQuestions, theme
- theme, primaryColor, isActive, isDefault

// services table  
- id, organizationId, name, description
- duration, price, category
- bufferTimeBefore, bufferTimeAfter
- All scheduling configuration fields

// bookings table
- Full booking management structure
```

### Server Function Pattern (Required)
```typescript
// MUST follow this pattern for all server operations
export const createService = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // Required for multi-tenancy
  .validator((data: unknown) => serviceSchema.parse(data)) // Required validation
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context
    
    // Validate permissions if needed
    if (!checkPermission(user, 'service:create')) {
      throw AppError.forbidden('Create service')
    }
    
    // Implementation with organizationId scoping
    const service = await db.insert(services).values({
      ...data,
      organizationId, // MUST include
      createdBy: user.id
    }).returning()
    
    return service[0]
  })
```

## Components to Migrate

### 1. Core Form Editor Components

#### FormFieldRenderer.tsx (FROM OLD - Critical)
- **Location**: `/src/components/FormFieldRenderer.tsx`
- **Purpose**: Customer-facing form field rendering
- **Important**: The existing one in joeyjob is wrong UI - MUST copy from old
- **Dependencies**: react-dropzone for file uploads
- **Target**: `/src/features/booking/components/FormFieldRenderer.tsx`

#### FormEditorLayout.tsx (1400+ lines)
- **Location**: `/src/pages/form-editor/FormEditorLayout.tsx`
- **Purpose**: Main container and layout orchestrator
- **Key Adaptations**:
  - Wrap with FormErrorBoundary
  - Replace `useNavigate` from 'react-router-dom' → '@tanstack/react-router'
  - Replace `useUpdateForm` hook to use server functions
  - Replace `useServices` hook to use server functions
  - Add organization context validation

#### FormFlowTree.tsx
- **Location**: `/src/components/FormFlowTree.tsx`
- **Purpose**: Visual service tree editor with drag-and-drop
- **Contains**: FlowNode and NodeType type definitions
- **Dependencies**: @dnd-kit (already installed)
- **Minimal Changes**: Mostly UI component, few adaptations needed

#### FormFieldEditor.tsx
- **Location**: `/src/components/FormFieldEditor.tsx`
- **Purpose**: Individual field configuration editor
- **Field Types**: All 10+ types supported
- **Minimal Changes**: Pure UI component, update imports to @/ui

#### question-list.tsx → QuestionList.tsx
- **Location**: `/src/components/question-list.tsx`
- **Purpose**: Sortable question list management
- **Dependencies**: @dnd-kit (already installed)
- **Contains**: Question component logic

#### BookingFlow.tsx (Critical for Preview)
- **Location**: `/src/components/BookingFlow.tsx`
- **Purpose**: Live preview of the booking form
- **Calendar Adaptation**: Use existing taali Calendar component instead of custom
- **Uses**: FormFieldRenderer for field display

#### BookingCalendar.tsx → BookingScheduler.tsx
- **Location**: `/src/components/BookingCalendar.tsx`
- **Purpose**: Calendar component for scheduling
- **Major Adaptation**: Replace with taali Calendar + custom time slot picker
- **Dependencies**: Use existing react-day-picker and date-fns

### 2. Calendar Components Adaptation

**SOLUTION**: Instead of migrating the custom calendar system that uses `@internationalized/date` and `@react-aria`, we'll adapt to use the existing taali Calendar component:

#### Existing Taali Components Available:
- **Calendar** (`/src/taali/components/ui/calendar.tsx`) - Uses react-day-picker
- **DatePicker** (`/src/taali/components/ui/date-picker.tsx`) - Date selection with popover
- **Date utilities** (`/src/taali/utils/date.ts`) - Comprehensive date/time formatting with timezone support

#### Migration Strategy for Calendar:
1. **Replace BookingCalendar** with new BookingScheduler that:
   - Uses taali Calendar for date selection
   - Creates custom TimeSlotPicker component for time selection
   - Uses date-fns instead of @internationalized/date

2. **Type Adaptations**:
   ```typescript
   // OLD: CalendarDate from @internationalized/date
   // NEW: Use Date objects with date-fns
   
   // OLD: parseDate, isSameDay from @internationalized/date
   // NEW: parseISO, isSameDay from date-fns
   ```

3. **No Need to Copy**:
   - `/src/components/calendar/*` files (5 components) - replaced by taali Calendar

### 3. Form Editor Views

All views need minimal changes (mainly import paths):

| View Component | Purpose | Adaptation Needed |
|---------------|---------|-------------------|
| RootView.tsx | Main navigation hub | Import paths to @/ui |
| ServicesView.tsx | Service management | Hook adaptations + @/ui imports |
| QuestionsView.tsx | Question editor | Import paths to @/ui |
| BrandingView.tsx | Theme customization | Import paths to @/ui |
| ServiceDetailsView.tsx | Service configuration | Hook adaptations + @/ui imports |
| ServiceQuestionsView.tsx | Service-specific questions | Import paths to @/ui |
| ServiceOptionsView.tsx | Service options | Import paths to @/ui |
| GroupDetailsView.tsx | Service grouping | Import paths to @/ui |
| SchedulingSettingsView.tsx | Scheduling rules | Import paths to @/ui |

### 4. Supporting Components

#### BackButton.tsx
- **Location**: `/src/pages/form-editor/components/BackButton.tsx`
- **Purpose**: Consistent back navigation in views
- **Minimal Changes**: Update imports to @/ui

#### Components Already Available:
- **SaveStatusIndicator** ✅ - Already exists at `/src/components/save-status-indicator.tsx`
- **ScrollArea** ✅ - Already in taali UI at `/src/taali/components/ui/scroll-area.tsx`
- **Tooltip** ✅ - Already in taali UI at `/src/taali/components/ui/tooltip.tsx`
- **All UI components** ✅ - Button, Card, Input, etc. all in taali

### 5. State Management & Context

#### FormEditorDataContext.tsx
- **Adaptation**: 
  - Keep React Query, replace API calls with server functions
  - Integrate useFormAutosave hook
  - Add FormErrorBoundary wrapper
  - Include organization validation

#### Hooks to Adapt
- `useFormEditorState.tsx` - Minimal changes
- `useFormEditorData.tsx` - Just a re-export, simple adaptation

### 6. Components NOT Needed

#### SecureStorage.ts ❌
- **Not needed**: Better Auth handles session management server-side
- **Remove**: All references to secureStorage in migrated code

#### Custom Calendar Components ❌
- **Not needed**: Using taali Calendar instead
- Files NOT to copy:
  - `/src/components/calendar/index.tsx`
  - `/src/components/calendar/calendar-cell.tsx`
  - `/src/components/calendar/calendar-grid.tsx`
  - `/src/components/calendar/calendar-header.tsx`
  - `/src/components/calendar/calendar-button.tsx`

#### Toast wrapper ❌
- **Not needed**: Use sonner directly (already installed)
- The old toast.tsx is just a wrapper, use `import { toast } from 'sonner'` directly

## New Components to Create

### TimeSlotPicker.tsx (New)
Since BookingCalendar uses time slot selection, create a new component:
```typescript
// /src/features/booking/components/TimeSlotPicker.tsx
interface TimeSlotPickerProps {
  availableSlots: string[]
  selectedSlot: string | null
  onSelectSlot: (slot: string) => void
  duration: number
}
```

### FormErrorBoundary Wrapper (New)
```typescript
// Wrap the form editor for error handling
<FormErrorBoundary>
  <FormEditorLayout />
</FormErrorBoundary>
```

## New Server Functions Required

Create in `/src/features/booking/lib/services.server.ts`:

```typescript
import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { nanoid } from 'nanoid'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { db } from '@/lib/db/db'
import { services } from '@/database/schema'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'

// Validation schemas
const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  duration: z.number().min(15).max(480), // 15 min to 8 hours
  price: z.number().min(0),
  category: z.string().optional(),
})

const updateServiceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  duration: z.number().min(15).max(480).optional(),
  price: z.number().min(0).optional(),
  // ... other fields
})

// Service CRUD operations with organizationMiddleware
export const getServices = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const { organizationId } = context
    
    const result = await db.select().from(services)
      .where(eq(services.organizationId, organizationId))
      .orderBy(services.name)
    
    return result
  })

export const createService = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createServiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context
    
    const service = await db.insert(services).values({
      id: nanoid(),
      ...data,
      organizationId,
      createdBy: user.id,
    }).returning()
    
    return service[0]
  })

export const updateService = createServerFn({ method: 'PUT' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => updateServiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    const { id, ...updates } = data
    
    // Verify service belongs to organization
    const existing = await db.select().from(services)
      .where(and(
        eq(services.id, id),
        eq(services.organizationId, organizationId)
      ))
      .limit(1)
    
    if (!existing.length) {
      throw AppError.notFound('Service')
    }
    
    const updated = await db.update(services)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning()
    
    return updated[0]
  })

export const deleteService = createServerFn({ method: 'DELETE' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    
    // Verify service belongs to organization
    const existing = await db.select().from(services)
      .where(and(
        eq(services.id, data.id),
        eq(services.organizationId, organizationId)
      ))
      .limit(1)
    
    if (!existing.length) {
      throw AppError.notFound('Service')
    }
    
    await db.delete(services).where(eq(services.id, data.id))
    
    return { success: true }
  })
```

## Hook Adaptations

### Transform API Client Hooks to Server Function Hooks

```typescript
// OLD: joeyjob-old/src/hooks/useServices.ts
export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => apiClient.services.list(),
  })
}

// NEW: joeyjob/src/features/booking/hooks/useServices.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { getServices, createService, updateService, deleteService } from '../lib/services.server'
import { useErrorHandler } from '@/lib/errors/hooks'

export function useServices() {
  const { activeOrganizationId } = useActiveOrganization()
  
  return useQuery({
    queryKey: ['services', activeOrganizationId],
    queryFn: () => getServices(),
    enabled: !!activeOrganizationId
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()
  const { activeOrganizationId } = useActiveOrganization()
  const { handleError, handleSuccess } = useErrorHandler()
  
  return useMutation({
    mutationFn: createService,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['services', activeOrganizationId] })
      handleSuccess({ message: `Service "${data.name}" created successfully` })
    },
    onError: (error) => handleError(error, { context: 'Creating service' })
  })
}

// Similar for useUpdateService, useDeleteService
```

## Auto-save Implementation

Using the established pattern from `todos.$id.edit.tsx` with FormErrorBoundary:

```typescript
// In FormEditorDataContext.tsx
import { useFormAutosave } from '@/taali/hooks/use-form-autosave'
import { FormErrorBoundary } from '@/components/form/form-error-boundary'

const FormEditorDataProvider = ({ children, formId }) => {
  const { activeOrganizationId } = useActiveOrganization()
  const queryClient = useQueryClient()
  
  const {
    data: formConfig,
    updateField,
    isSaving,
    lastSaved,
    saveNow,
    isDirty,
    errors,
  } = useFormAutosave<BookingFlowData>({
    initialData: form.formConfig,
    validate: validateFormConfig,
    onSave: async (data) => {
      await updateForm({
        data: {
          id: formId,
          formConfig: data,
          // Also update theme, primaryColor if changed
        }
      })
      
      // Invalidate queries
      await queryClient.invalidateQueries({
        queryKey: ['forms', activeOrganizationId]
      })
    },
    enabled: !!form && !!activeOrganizationId,
    debounceMs: 2000, // 2 second debounce
  })
  
  return (
    <FormErrorBoundary>
      <FormContext.Provider value={{ ... }}>
        {children}
      </FormContext.Provider>
    </FormErrorBoundary>
  )
}
```

## Validation Registry Integration

Add form field validation to the registry:

```typescript
// In /src/lib/validation/validation-registry.ts
export const validationRules = {
  // ... existing rules
  
  formField: {
    label: z.string()
      .min(1, vm.formField.label.required)
      .max(100, vm.formField.label.max(100)),
    
    name: z.string()
      .min(1, vm.formField.name.required)
      .max(50, vm.formField.name.max(50))
      .regex(/^[a-z_][a-z0-9_]*$/, vm.formField.name.pattern),
    
    options: z.array(z.object({
      label: z.string().min(1).max(100),
      value: z.string().min(1).max(100),
    })).min(1, vm.formField.options.required),
  },
  
  service: {
    name: z.string()
      .min(1, vm.service.name.required)
      .max(100, vm.service.name.max(100)),
    
    duration: z.number()
      .min(15, vm.service.duration.min(15))
      .max(480, vm.service.duration.max(480)),
    
    price: z.number()
      .min(0, vm.service.price.min(0)),
  }
}
```

## Directory Structure (Updated with kebab-case naming)

```
src/
├── routes/
│   └── _authenticated/
│       └── form.$formId.edit.tsx (main route, updated)
└── features/
    └── booking/
        ├── components/
        │   ├── form-field-renderer.tsx (copied from old, critical - rename)
        │   ├── form-editor/
        │   │   ├── form-editor-layout.tsx (renamed from FormEditorLayout)
        │   │   ├── form-flow-tree.tsx (renamed from FormFlowTree)
        │   │   ├── form-field-editor.tsx (renamed from FormFieldEditor)
        │   │   ├── question-list.tsx (already kebab-case)
        │   │   ├── booking-flow.tsx (renamed from BookingFlow)
        │   │   ├── booking-scheduler.tsx (adapted from BookingCalendar)
        │   │   ├── time-slot-picker.tsx (new component)
        │   │   ├── back-button.tsx (renamed from BackButton)
        │   │   ├── views/
        │   │   │   ├── root-view.tsx (renamed from RootView)
        │   │   │   ├── services-view.tsx (renamed from ServicesView)
        │   │   │   ├── questions-view.tsx (renamed from QuestionsView)
        │   │   │   ├── branding-view.tsx (renamed from BrandingView)
        │   │   │   ├── service-details-view.tsx (renamed from ServiceDetailsView)
        │   │   │   ├── service-questions-view.tsx (renamed from ServiceQuestionsView)
        │   │   │   ├── service-options-view.tsx (renamed from ServiceOptionsView)
        │   │   │   ├── group-details-view.tsx (renamed from GroupDetailsView)
        │   │   │   └── scheduling-settings-view.tsx (renamed from SchedulingSettingsView)
        │   │   ├── context/
        │   │   │   └── form-editor-data-context.tsx (renamed from FormEditorDataContext)
        │   │   ├── hooks/
        │   │   │   ├── use-form-editor-state.tsx (renamed from useFormEditorState)
        │   │   │   ├── use-form-editor-data.tsx (renamed from useFormEditorData)
        │   │   │   ├── use-services.ts (renamed from useServices)
        │   │   │   └── use-forms.ts (renamed from useForms)
        │   │   └── components/
        │   │       ├── form-editor-header.tsx (renamed from FormEditorHeader)
        │   │       ├── form-editor-sidebar.tsx (renamed from FormEditorSidebar)
        │   │       └── form-editor-preview.tsx (renamed from FormEditorPreview)
        │   └── form-field-editor.tsx (existing - will be replaced)
        └── lib/
            ├── form-field-types.ts (existing, compatible)
            ├── form-validation.ts (existing)
            ├── form-validation-schemas.ts (new, for validation registry)
            ├── forms.server.ts (existing, may need updates)
            └── services.server.ts (new, for service CRUD)
```

## Implementation Steps

### Phase 1: Server Functions & Infrastructure (Critical Foundation)
1. **Install react-dropzone** dependency
2. **Create services.server.ts** with organizationMiddleware
3. **Add validation schemas** to validation registry
4. **Create adapter hooks** with proper error handling

### Phase 2: Copy Core Components (Exact UI from Old)
5. **Copy FormFieldRenderer.tsx from joeyjob-old** → **form-field-renderer.tsx** (CRITICAL - old UI is correct)
6. **Copy FormEditorLayout.tsx** → **form-editor-layout.tsx**
   - Wrap with FormErrorBoundary
   - Update imports to @/ui
   - Replace router hooks
7. **Copy FormFlowTree.tsx** → **form-flow-tree.tsx** with FlowNode types
8. **Copy FormFieldEditor.tsx** → **form-field-editor.tsx** with all field types
9. **Copy question-list.tsx** → **question-list.tsx** (already kebab-case)

### Phase 3: Views Migration (Maintain Exact UI)
10. **Copy all view components** (rename to kebab-case):
    - RootView.tsx → **root-view.tsx**
    - ServicesView.tsx → **services-view.tsx** 
    - QuestionsView.tsx → **questions-view.tsx**
    - BrandingView.tsx → **branding-view.tsx**
    - ServiceDetailsView.tsx → **service-details-view.tsx**
    - ServiceQuestionsView.tsx → **service-questions-view.tsx**
    - ServiceOptionsView.tsx → **service-options-view.tsx**
    - GroupDetailsView.tsx → **group-details-view.tsx**
    - SchedulingSettingsView.tsx → **scheduling-settings-view.tsx**
    - Update ALL imports to use @/ui
    - Replace API hooks with server function hooks
    - Maintain exact UI/UX from old

11. **Copy BackButton.tsx** → **back-button.tsx** and other supporting components

### Phase 4: State Management with Safety
12. **Copy FormEditorDataContext.tsx** → **form-editor-data-context.tsx**
    - Add FormErrorBoundary wrapper
    - Integrate useFormAutosave hook
    - Add organization validation
    - Connect to server functions

13. **Copy and adapt hooks** (rename to kebab-case):
    - useFormEditorState.tsx → **use-form-editor-state.tsx** (minimal changes)
    - useFormEditorData.tsx → **use-form-editor-data.tsx** (server functions)
    - Create **use-services.ts** and **use-forms.ts** hooks

### Phase 5: Preview Components  
14. **Copy BookingFlow.tsx** → **booking-flow.tsx**
    - Update calendar imports to use taali
    - Use form-field-renderer for display

15. **Create booking-scheduler.tsx**
    - Replace BookingCalendar functionality
    - Use taali Calendar
    - Create **time-slot-picker.tsx**

### Phase 6: Integration & Auto-save
16. **Implement auto-save**
    - Use useFormAutosave with 2-second debounce
    - Use existing SaveStatusIndicator
    - Handle validation errors
    - Add FormErrorBoundary

17. **Update main route**
    - Modify form.$formId.edit.tsx
    - Use new **form-editor-layout** component
    - Remove placeholder code

### Phase 7: Testing & Validation
18. **Test organization isolation**
    - Verify organizationId scoping
    - Test multi-tab support

19. **Test form functionality**
    - Drag-and-drop operations
    - All field types
    - Auto-save behavior
    - Error boundaries

## Key Differences from Original Plan

### Corrections Made:
1. **FormFieldRenderer MUST be copied** - Existing joeyjob version is wrong UI
2. **ALL imports use @/ui** - Never use relative paths for UI components
3. **FormErrorBoundary is required** - Must wrap all forms
4. **Organization validation mandatory** - All operations must validate membership
5. **Validation registry pattern** - Centralized validation rules
6. **AppError usage required** - Never throw generic errors

### What Stays the Same:
- All UI components can be copied with minimal changes
- Drag-and-drop functionality (@dnd-kit) works as-is
- Field types and validation remain consistent
- Auto-save pattern from todo editor applies perfectly

## Dependencies Verification

### Already Installed ✅
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- framer-motion
- react-hook-form
- react-day-picker (used by taali Calendar)
- date-fns, date-fns-tz (comprehensive date handling)
- lucide-react
- All Radix UI components
- lodash (for debounce)
- TanStack Query
- sonner (for toast notifications)

### Needs Installation 🔴
- **react-dropzone** - Required for file uploads in FormFieldRenderer
  ```bash
  pnpm add react-dropzone
  ```

### NOT Needed (Using Alternatives) ❌
- ~~@internationalized/date~~ → Using date-fns
- ~~@react-aria/calendar~~ → Using react-day-picker  
- ~~@react-aria/i18n~~ → Using react-i18next
- ~~crypto-js~~ → Not needed (Better Auth handles security)
- ~~Custom toast wrapper~~ → Use sonner directly

## Success Criteria

- [ ] All form editor views accessible and functional
- [ ] Drag-and-drop working for services and questions
- [ ] All 10+ field types configurable
- [ ] Service CRUD operations working with organization scoping
- [ ] Auto-save working with 2-second debounce
- [ ] Save status indicator showing correct states
- [ ] No TypeScript errors
- [ ] Form preview (BookingFlow) updates in real-time
- [ ] Data persists correctly to PostgreSQL
- [ ] UI matches joeyjob-old exactly
- [ ] Calendar/scheduling uses taali components
- [ ] FormErrorBoundary catches and handles errors gracefully
- [ ] All imports use @/ui alias
- [ ] Organization isolation verified
- [ ] Validation messages consistent and translatable

## Risk Mitigation

### Identified Risks & Solutions

1. **Import Path Violations**
   - Risk: Using incorrect import paths for UI components
   - Solution: Global search/replace to ensure all use @/ui
   - Validation: ESLint rules to enforce

2. **Organization Security**
   - Risk: Data leakage between organizations
   - Solution: Always use organizationMiddleware
   - Validation: Test with multiple organizations

3. **Form Error Handling**
   - Risk: Forms crashing without error boundaries
   - Solution: Wrap all forms with FormErrorBoundary
   - Validation: Test error scenarios

4. **Calendar Component Differences**
   - Risk: UI/UX changes from custom calendar to taali Calendar
   - Solution: Create custom styling to match original look
   - Fallback: If needed, can still install @internationalized/date

5. **Auto-save Race Conditions**
   - Risk: Multiple saves conflicting
   - Solution: Use debouncing and save queue from useFormAutosave
   - Validation: Test with rapid edits

## Timeline

- **Total Duration**: 5 days
- **Day 1**: Server functions, validation, and infrastructure
- **Day 1-2**: Core components migration (exact UI from old)
- **Day 2-3**: Views migration with @/ui imports
- **Day 3-4**: State management with error boundaries
- **Day 4-5**: Auto-save integration and testing

## Next Steps

1. Install react-dropzone dependency
2. Create services.server.ts with CRUD operations
3. Begin copying components (FormFieldRenderer first - critical)
4. Ensure all imports use @/ui alias
5. Wrap forms with FormErrorBoundary
6. Test each phase before proceeding
7. Final integration testing with organization isolation

## Notes

- **The old UI is the correct UI** - Copy exactly from joeyjob-old
- **Framework compliance is mandatory** - Follow all patterns from docs
- **Security through organizationMiddleware** - Never skip
- **Error handling with AppError** - No generic errors
- **Validation through registry** - Centralized rules
- **All UI imports use @/ui** - No exceptions