# Auto-Save Implementation Guide

## Overview
This guide documents the complete auto-save system used in the Taali todo application. The system provides real-time saving with visual feedback, automatic debouncing, and optimistic UI updates - creating a seamless editing experience similar to Google Docs.

## Core Components

### 1. useFormAutosave Hook
The heart of the auto-save system. This custom React hook manages form state, handles automatic saving, and provides save status information.

```typescript
// hooks/useFormAutosave.tsx
interface UseFormAutosaveOptions<T> {
  initialData: T;                    // Initial form data
  onSave: (data: T) => Promise<void | T>;  // Save function (can return normalized data)
  debounceMs?: number;               // Debounce delay (default: 3000ms)
  enabled?: boolean;                  // Enable/disable auto-save
  validate?: (data: T) => { isValid: boolean; errors: string[] };
  compareFunction?: (a: T, b: T) => boolean;  // Custom comparison for dirty checking
}
```

**Key Features:**
- **Automatic Debouncing**: Saves are debounced by 3 seconds by default
- **Blur Saving**: Immediately saves when field loses focus
- **Dirty State Tracking**: Only saves when data has actually changed
- **Validation Support**: Can validate data before saving
- **Normalization**: Can return normalized data from save function

### 2. Save Flow

#### When Auto-Save Triggers:
1. **On Change**: After 3 seconds of no typing (debounced)
2. **On Blur**: Immediately when input loses focus
3. **Manual**: Via `saveNow()` function

#### The Save Process:
```typescript
// Example from EditTodoPage.tsx
const {
  data: formData,
  updateField,
  isSaving,
  lastSaved,
  saveNow,
  isDirty,
} = useFormAutosave<TodoFormData>({
  initialData,
  validate: validateTodoData,
  compareFunction: compareFormData,
  onSave: async (data) => {
    // 1. Validate data
    const validation = validateTodoData(data);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // 2. Trim and prepare data
    const trimmedTitle = data.title.trim();
    const trimmedDescription = data.description.trim();
    
    // 3. Call mutation
    await updateTodoMutation.mutateAsync({
      id: todo.id,
      title: trimmedTitle,
      description: trimmedDescription || undefined,
      visibility: data.visibility,
    });
    
    // 4. Return normalized data (optional)
    return {
      title: trimmedTitle,
      description: trimmedDescription,
      visibility: data.visibility,
    };
  },
  enabled: !!todo,
});
```

### 3. Visual Feedback - SaveStatusIndicator

Provides real-time visual feedback about save status:

```typescript
// components/SaveStatusIndicator.tsx
export function SaveStatusIndicator({ 
  isSaving, 
  lastSaved, 
  isDirty 
}: SaveStatusIndicatorProps) {
  if (isSaving) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Saving changes</span>
      </div>
    );
  }

  if (lastSaved && !isDirty) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className="h-3 w-3" />
        <span>Changes saved</span>
      </div>
    );
  }

  return null; // No indicator when no changes or not saved yet
}
```

**Status States:**
- **Saving**: Shows spinner with "Saving changes"
- **Saved**: Shows checkmark with "Changes saved"
- **Dirty/Unsaved**: No indicator (clean UI)

### 4. Implementation Pattern

#### Step 1: Create New Item
```typescript
// TodosPage.tsx - Create button handler
const createTodoMutation = trpc.todos.create.useMutation({
  onSuccess: (newTodo) => {
    toast.success('Todo created successfully');
    // Navigate directly to edit page
    navigate(`/todos/${newTodo.id}/edit`);
  },
});

const handleCreateTodo = () => {
  createTodoMutation.mutate({
    workspaceId: currentWorkspace.id,
    title: 'Untitled Todo',  // Default title
    description: undefined,
    visibility: 'RESTRICTED',
  });
};
```

#### Step 2: Edit Page Setup
```typescript
// EditTodoPage.tsx - Main edit page component
export function EditTodoPage() {
  const { id } = useParams<{ id: string }>();
  
  // 1. Fetch the item data
  const { data: todo, isLoading } = trpc.todos.getById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  // 2. Setup mutation for updates
  const updateTodoMutation = trpc.todos.update.useMutation({
    onSuccess: (_, updateData) => {
      // Optimistically update cache
      // ... cache update logic
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    },
  });

  // 3. Initialize form data (memoized to prevent re-renders)
  const initialData = useMemo(() => ({
    title: todo?.title || '',
    description: todo?.description || '',
    visibility: todo?.visibility || 'RESTRICTED',
  }), [todo]);

  // 4. Setup auto-save
  const {
    data: formData,
    updateField,
    isSaving,
    lastSaved,
    saveNow,
    isDirty,
  } = useFormAutosave<TodoFormData>({
    initialData,
    validate: validateTodoData,
    compareFunction: compareFormData,
    onSave: async (data) => {
      // Save implementation
    },
    enabled: !!todo,
  });

  // 5. Render form with auto-save
  return (
    <PageHeader 
      actions={
        <SaveStatusIndicator 
          isSaving={isSaving} 
          lastSaved={lastSaved} 
          isDirty={isDirty}
        />
      }
    >
      <Input
        value={formData.title}
        onChange={(e) => updateField('title', e.target.value)}
        onBlur={saveNow}  // Save immediately on blur
      />
    </PageHeader>
  );
}
```

### 5. Data Validation

Implement validation to ensure data integrity:

```typescript
const validateTodoData = useCallback((data: TodoFormData) => {
  const errors: string[] = [];
  const trimmedTitle = data.title.trim();

  // Title validation
  if (!trimmedTitle) {
    errors.push('Title is required');
  } else if (trimmedTitle.length > 200) {
    errors.push('Title must be 200 characters or less');
  }

  // Description validation
  if (data.description?.trim().length > 1000) {
    errors.push('Description must be 1000 characters or less');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}, []);
```

### 6. Smart Comparison

Use custom comparison to handle whitespace and avoid unnecessary saves:

```typescript
const compareFormData = useCallback((a: TodoFormData, b: TodoFormData) => {
  return (
    a.title.trim() === b.title.trim() &&
    a.description.trim() === b.description.trim() &&
    a.visibility === b.visibility
  );
}, []);
```

### 7. Backend Implementation

The backend uses tRPC procedures with proper validation:

```typescript
// domains/todos/router.ts
update: authenticatedProcedure
  .input(validation.update)
  .mutation(async ({ ctx, input }) => {
    const service = TodosService.create(typedDatabase);
    const todo = await service.updateTodo(input, ctx.currentUser.id);
    
    if (!todo) {
      throw errors.notFound('Todo not found or access denied');
    }

    return todo;
  }),
```

## Complete Integration Example

Here's how to implement this system for a new entity:

```typescript
// 1. Define your form data type
interface NoteFormData {
  title: string;
  content: string;
  tags: string[];
}

// 2. Create the edit page component
export function EditNotePage() {
  const { id } = useParams();
  
  // Fetch data
  const { data: note } = trpc.notes.getById.useQuery({ id });
  
  // Setup mutation
  const updateNoteMutation = trpc.notes.update.useMutation({
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    },
  });

  // Initialize form data
  const initialData = useMemo(() => ({
    title: note?.title || '',
    content: note?.content || '',
    tags: note?.tags || [],
  }), [note]);

  // Validation
  const validateNoteData = useCallback((data: NoteFormData) => {
    const errors: string[] = [];
    if (!data.title.trim()) {
      errors.push('Title is required');
    }
    return { isValid: errors.length === 0, errors };
  }, []);

  // Setup auto-save
  const {
    data: formData,
    updateField,
    isSaving,
    lastSaved,
    isDirty,
    saveNow,
  } = useFormAutosave({
    initialData,
    validate: validateNoteData,
    onSave: async (data) => {
      await updateNoteMutation.mutateAsync({
        id: note.id,
        title: data.title.trim(),
        content: data.content.trim(),
        tags: data.tags,
      });
      
      return {
        title: data.title.trim(),
        content: data.content.trim(),
        tags: data.tags,
      };
    },
    enabled: !!note,
    debounceMs: 3000, // 3 second debounce
  });

  return (
    <div>
      {/* Save status indicator */}
      <SaveStatusIndicator 
        isSaving={isSaving} 
        lastSaved={lastSaved} 
        isDirty={isDirty}
      />
      
      {/* Form fields with auto-save */}
      <Input
        value={formData.title}
        onChange={(e) => updateField('title', e.target.value)}
        onBlur={saveNow}
        placeholder="Note title"
      />
      
      <Textarea
        value={formData.content}
        onChange={(e) => updateField('content', e.target.value)}
        onBlur={saveNow}
        placeholder="Note content"
      />
    </div>
  );
}
```

## Key Implementation Notes

1. **Debounce Time**: 3 seconds is optimal - not too frequent but responsive enough
2. **Blur Saving**: Always save on blur for immediate feedback when switching fields
3. **Validation**: Run validation before saving to prevent bad data
4. **Normalization**: Trim whitespace and normalize data in the save function
5. **Error Handling**: Show toast notifications for save failures
6. **Cache Updates**: Update tRPC cache optimistically for instant UI updates
7. **Dirty State**: Track if form has unsaved changes for better UX
8. **Loading States**: Handle loading, saving, and error states gracefully

## Benefits

- **No Save Button**: Users never lose work
- **Real-time Feedback**: Users know when changes are saved
- **Optimized Performance**: Debouncing prevents excessive API calls
- **Data Integrity**: Validation ensures clean data
- **Seamless Experience**: Works like Google Docs or Notion

## Dependencies

```json
{
  "dependencies": {
    "lodash": "^4.17.21",  // For debounce
    "sonner": "^1.0.0",     // For toast notifications
    "lucide-react": "^0.0.0", // For icons
    "@tanstack/react-query": "^5.0.0" // Via tRPC
  }
}
```

## Testing Considerations

1. Test debounce timing with different typing speeds
2. Verify blur saves work correctly
3. Test validation edge cases
4. Ensure proper error handling
5. Verify optimistic updates work correctly
6. Test with slow network conditions
7. Verify dirty state tracking accuracy

This system provides a robust, user-friendly auto-save experience that can be easily adapted to any form-based editing interface.