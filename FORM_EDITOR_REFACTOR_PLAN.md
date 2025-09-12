# Form Editor Rewrite Plan

## Executive Summary

This document outlines a complete rewrite of the form editor that eliminates architectural complexity through modern state management. The new design uses Zustand for state management, normalized data structures, and enhanced separation of concerns for maximum elegance and maintainability.

## Current State Analysis

### Problems Identified

1. **Component Size**: `FormEditorLayout.tsx` is 1300+ lines with too many responsibilities
2. **State Management Complexity**: Multiple overlapping state systems (local state, context, refs, reducers)
3. **Nested Data Structures**: Deep tree traversal required for simple updates
4. **Dirty State Tracking**: Complex ref-based tracking that causes false positives
5. **Scattered State**: 77 occurrences of `useReducer|useState` across 16 files
6. **Mixed Concerns**: Business logic intertwined with UI components
7. **Provider Hell**: Multiple nested contexts causing prop drilling and re-render cascades
8. **No Undo/Redo**: Difficult to implement with current architecture

### Existing Good Parts to Keep

1. **Validation System** (`validation.ts`) - Comprehensive and well-tested
2. **Node Operations** (`node-operations.ts`) - Good utilities, just needs adaptation
3. **Type Definitions** - Form field types are well-defined
4. **React Query Integration** - Already in place for API calls
5. **API Layer** - Backend integration works well

## Proposed Architecture

### Core Philosophy: Zustand + Normalized State + Command Pattern

The new architecture leverages Zustand's simplicity with normalized data structures and command pattern for operations, creating an elegant and extensible solution.

### Core Concept: Normalized State

Instead of nested trees that require traversal, use a flat, normalized structure:

```typescript
// ❌ OLD: Nested structure (hard to update)
const tree = {
  id: 'root',
  children: [
    {
      id: 'group1',
      children: [
        { id: 'service1', ... }
      ]
    }
  ]
};

// ✅ NEW: Normalized structure (easy to update)
const nodes = {
  'root': { id: 'root', childIds: ['group1'] },
  'group1': { id: 'group1', parentId: 'root', childIds: ['service1'] },
  'service1': { id: 'service1', parentId: 'group1' }
};
```

### State Management with Zustand

```typescript
// Separate stores for different concerns
interface FormDataStore {
  // Domain State (persisted)
  id: string;
  name: string;
  slug: string;
  theme: 'light' | 'dark';
  primaryColor: string;
  
  // Normalized Data
  nodes: Record<string, Node>;
  questions: Record<string, Question>;
  rootId: string;
  
  // Actions
  updateNode: (id: string, updates: Partial<Node>) => void;
  addNode: (parentId: string, node: Omit<Node, 'id'>) => string;
  deleteNode: (id: string) => void;
  moveNode: (nodeId: string, newParentId: string, index?: number) => void;
  
  // Computed Selectors
  getTree: () => TreeNode;
  getNodeWithDetails: (id: string) => NodeWithDetails;
}

interface UIStore {
  // Ephemeral UI State
  selectedNodeId: string | null;
  currentView: ViewType;
  expandedNodes: Set<string>;
  isDragging: boolean;
  
  // Actions
  selectNode: (id: string | null) => void;
  toggleNodeExpansion: (id: string) => void;
  setView: (view: ViewType) => void;
}

// Type-safe discriminated union for nodes
type Node = 
  | { type: 'root'; id: string; childIds: string[]; title: string }
  | { type: 'service'; id: string; parentId: string; serviceId: string; questionIds: string[]; duration: number }
  | { type: 'group'; id: string; parentId: string; childIds: string[]; label: string; description?: string };
```

### Component Architecture

```
form-editor/
├── FormEditor.tsx              # Main component (50 lines)
├── core/                      # Domain logic (pure, no React)
│   ├── models/                # Node, Question, Form types
│   ├── commands/              # Command pattern operations
│   │   ├── AddNodeCommand.ts
│   │   ├── MoveNodeCommand.ts
│   │   └── UpdateNodeCommand.ts
│   ├── validation/            # Rules engine
│   └── migration/             # Data migration utilities
├── stores/                    # Zustand stores
│   ├── form-store.ts          # Domain state
│   ├── ui-store.ts            # UI state
│   └── command-store.ts       # Command history for undo/redo
├── ui/                        # Presentation layer
│   ├── views/                 # Page-level components
│   │   ├── TreeView.tsx
│   │   ├── NodeEditor.tsx
│   │   └── QuestionsEditor.tsx
│   ├── widgets/               # Reusable UI elements
│   └── layouts/               # Layout components
├── hooks/                     # Custom hooks
│   ├── useAutosave.ts         # Optimistic updates
│   ├── useCommands.ts         # Command execution
│   └── useKeyboardShortcuts.ts
└── services/                  # API integration
    └── api.ts                 # Backend communication
```

## Implementation Strategy

### Phase 1: Core Architecture with Zustand (Day 1-2)

#### 1.1 Create Zustand Stores
```typescript
// stores/form-store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export const useFormStore = create<FormDataStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        id: '',
        name: '',
        slug: '',
        theme: 'light',
        primaryColor: '#3B82F6',
        nodes: {},
        questions: {},
        rootId: 'root',
        
        // Actions with Immer for immutability
        updateNode: (id, updates) => set(state => {
          state.nodes[id] = { ...state.nodes[id], ...updates };
        }),
        
        addNode: (parentId, node) => {
          const id = `node-${Date.now()}`;
          set(state => {
            state.nodes[id] = { ...node, id };
            if (state.nodes[parentId]) {
              state.nodes[parentId].childIds.push(id);
            }
          });
          return id;
        },
        
        deleteNode: (id) => set(state => {
          const node = state.nodes[id];
          if (!node) return;
          
          // Remove from parent
          const parent = Object.values(state.nodes).find(n => 
            'childIds' in n && n.childIds.includes(id)
          );
          if (parent) {
            parent.childIds = parent.childIds.filter(cId => cId !== id);
          }
          
          // Delete node and orphaned children
          delete state.nodes[id];
        }),
        
        // Computed selectors
        getTree: () => {
          const state = get();
          const buildTree = (id: string): TreeNode => {
            const node = state.nodes[id];
            if (!node) return null;
            
            return {
              ...node,
              children: 'childIds' in node 
                ? node.childIds.map(buildTree).filter(Boolean)
                : []
            };
          };
          return buildTree(state.rootId);
        },
        
        getNodeWithDetails: (id) => {
          const state = get();
          const node = state.nodes[id];
          if (!node) return null;
          
          return {
            ...node,
            questions: 'questionIds' in node
              ? node.questionIds.map(qId => state.questions[qId])
              : [],
            parent: 'parentId' in node && node.parentId
              ? state.nodes[node.parentId]
              : null
          };
        }
      })),
      { name: 'form-editor' }
    )
  )
);
```

#### 1.2 Command Pattern Implementation
```typescript
// core/commands/base.ts
export interface Command {
  id: string;
  timestamp: number;
  execute(): void | Promise<void>;
  undo(): void;
  redo(): void;
  canExecute(): boolean;
  description: string;
}

// core/commands/AddNodeCommand.ts
export class AddNodeCommand implements Command {
  constructor(
    private store: FormDataStore,
    private parentId: string,
    private node: Omit<Node, 'id'>
  ) {}
  
  execute() {
    this.nodeId = this.store.addNode(this.parentId, this.node);
  }
  
  undo() {
    if (this.nodeId) {
      this.store.deleteNode(this.nodeId);
    }
  }
  
  redo() {
    this.execute();
  }
  
  canExecute() {
    return !!this.store.nodes[this.parentId];
  }
}

// stores/command-store.ts
export const useCommandStore = create<CommandStore>((set, get) => ({
  history: [],
  currentIndex: -1,
  
  execute: async (command: Command) => {
    if (!command.canExecute()) return;
    
    await command.execute();
    
    set(state => ({
      history: [...state.history.slice(0, state.currentIndex + 1), command],
      currentIndex: state.currentIndex + 1
    }));
  },
  
  undo: () => {
    const { history, currentIndex } = get();
    if (currentIndex >= 0) {
      history[currentIndex].undo();
      set({ currentIndex: currentIndex - 1 });
    }
  },
  
  redo: () => {
    const { history, currentIndex } = get();
    if (currentIndex < history.length - 1) {
      history[currentIndex + 1].redo();
      set({ currentIndex: currentIndex + 1 });
    }
  }
}));
```

#### 1.3 Migration Function
```typescript
// utils/migrate.ts
export function migrateFromOldFormat(oldData: BookingFlowData): FormState {
  const nodes: Record<string, Node> = {};
  
  // Flatten nested tree into normalized structure
  function processNode(node: FlowNode, parentId: string | null = null) {
    nodes[node.id] = {
      id: node.id,
      type: node.type,
      label: node.label,
      parentId,
      childIds: node.children?.map(c => c.id) || [],
      // ... other fields
    };
    
    node.children?.forEach(child => processNode(child, node.id));
  }
  
  processNode(oldData.serviceTree);
  
  return {
    id: oldData.id,
    name: oldData.internalName,
    nodes,
    // ... rest of state
  };
}
```

### Phase 2: UI Store & Event System (Day 3)

#### 2.1 UI Store Implementation
```typescript
// stores/ui-store.ts
export const useUIStore = create<UIStore>((set) => ({
  selectedNodeId: null,
  currentView: 'tree',
  expandedNodes: new Set(['root']),
  isDragging: false,
  
  selectNode: (id) => set({ selectedNodeId: id }),
  
  toggleNodeExpansion: (id) => set(state => {
    const expanded = new Set(state.expandedNodes);
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    return { expandedNodes: expanded };
  }),
  
  setView: (view) => set({ currentView: view })
}));
```
```

#### 2.2 Event Bus for Loose Coupling
```typescript
// core/events/event-bus.ts
type EventMap = {
  'node.selected': { nodeId: string };
  'node.updated': { nodeId: string; changes: Partial<Node> };
  'node.deleted': { nodeId: string };
  'form.saved': { formId: string };
  'validation.failed': { errors: ValidationError[] };
};

class EventBus {
  private events = new Map<string, Set<Function>>();
  
  on<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
    
    return () => this.events.get(event)?.delete(handler);
  }
  
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    this.events.get(event)?.forEach(handler => handler(payload));
  }
}

export const eventBus = new EventBus();

// Usage in components
export function useEventSubscription<K extends keyof EventMap>(
  event: K,
  handler: (payload: EventMap[K]) => void
) {
  useEffect(() => {
    return eventBus.on(event, handler);
  }, [event, handler]);
}
```

### Phase 3: Component Implementation (Day 4-5)

#### 3.1 Main Component
```typescript
// FormEditor.tsx
export function FormEditor({ formId }: { formId: string }) {
  const { currentView } = useUIStore();
  const { execute, undo, redo, canUndo, canRedo } = useCommandStore();
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    'cmd+z': undo,
    'cmd+shift+z': redo,
    'cmd+s': () => eventBus.emit('form.save', { formId })
  });
  
  return (
    <div className="flex h-screen bg-background">
      <aside className="w-80 border-r">
        <TreeView />
      </aside>
      
      <main className="flex-1 flex flex-col">
        <FormEditorHeader 
          canUndo={canUndo} 
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />
        <ViewRouter view={currentView} />
      </main>
      
      <aside className="w-96 border-l">
        <FormPreview />
      </aside>
    </div>
  );
}
```

#### 3.2 Tree View with Zustand
```typescript
// ui/views/TreeView.tsx
export function TreeView() {
  const tree = useFormStore(state => state.getTree());
  const { selectedNodeId, selectNode, expandedNodes, toggleNodeExpansion } = useUIStore();
  const { execute } = useCommandStore();
  
  const handleDrop = useCallback((draggedId: string, targetId: string) => {
    const command = new MoveNodeCommand(useFormStore.getState(), draggedId, targetId);
    execute(command);
  }, [execute]);
  
  return (
    <div className="p-4">
      <TreeNode 
        node={tree}
        selectedId={selectedNodeId}
        expandedNodes={expandedNodes}
        onSelect={selectNode}
        onToggleExpand={toggleNodeExpansion}
        onDrop={handleDrop}
      />
    </div>
  );
}

function TreeNode({ node, selectedId, expandedNodes, onSelect, onToggleExpand, onDrop }) {
  const isSelected = node.id === selectedId;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children?.length > 0;
  
  return (
    <div>
      <div 
        onClick={() => onSelect(node.id)}
        className={cn(
          "flex items-center p-2 rounded cursor-pointer",
          isSelected && "bg-primary/10",
          "hover:bg-gray-100"
        )}
        draggable
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData('nodeId');
          onDrop(draggedId, node.id);
        }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="mr-1"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        <span>{node.label}</span>
      </div>
      
      {isExpanded && node.children?.map(child => (
        <div key={child.id} className="ml-4">
          <TreeNode {...props} node={child} />
        </div>
      ))}
    </div>
  );
}
```

### Phase 4: Optimistic Updates & Autosave (Day 6)

```typescript
// hooks/useOptimisticAutosave.ts
export function useOptimisticAutosave() {
  const formStore = useFormStore();
  const queryClient = useQueryClient();
  const [saveQueue, setSaveQueue] = useState<SaveOperation[]>([]);
  
  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      // Apply optimistic update immediately
      const optimisticId = `optimistic-${Date.now()}`;
      
      // Store optimistic state
      queryClient.setQueryData(
        ['form', data.id, 'optimistic'],
        { ...data, optimisticId }
      );
      
      // Perform actual save
      return api.saveForm(transformForAPI(data));
    },
    
    onSuccess: (result, variables) => {
      // Reconcile server state with local state
      const localState = formStore.getState();
      const serverState = result.data;
      
      // Merge any changes that happened during save
      const reconciledState = reconcile(serverState, localState, variables);
      
      // Update store with reconciled state
      formStore.setState(reconciledState);
      
      // Clear optimistic state
      queryClient.removeQueries(['form', variables.id, 'optimistic']);
    },
    
    onError: (error, variables) => {
      // Rollback optimistic changes
      const previousState = queryClient.getQueryData(['form', variables.id]);
      if (previousState) {
        formStore.setState(previousState);
      }
      
      // Notify user
      eventBus.emit('save.failed', { error: error.message });
    },
    
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
  
  // Subscribe to store changes with debouncing
  useEffect(() => {
    const unsubscribe = formStore.subscribe(
      state => state,
      (state) => {
        // Debounce saves
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          if (isFormDirty(state)) {
            saveMutation.mutate(state);
          }
        }, 2000);
      }
    );
    
    return unsubscribe;
  }, []);
  
  return {
    isSaving: saveMutation.isLoading,
    lastSaved: saveMutation.data?.timestamp,
    saveError: saveMutation.error
  };
}

// Reconciliation logic for handling concurrent edits
function reconcile(server: FormState, local: FormState, original: FormState): FormState {
  // Three-way merge: server changes + local changes since original
  const result = { ...server };
  
  // Apply local changes that don't conflict
  Object.keys(local.nodes).forEach(id => {
    if (!server.nodes[id] && local.nodes[id] && !original.nodes[id]) {
      // Node was added locally and doesn't exist on server
      result.nodes[id] = local.nodes[id];
    }
  });
  
  return result;
}
```

### Phase 5: Performance & Polish (Day 7-8)

#### 5.1 Virtual Scrolling for Large Trees
```typescript
// ui/components/VirtualTree.tsx
import { FixedSizeTree } from 'react-vtree';

export function VirtualTree({ nodes, height = 600 }) {
  const treeWalker = useCallback(
    function* treeWalker() {
      for (const node of nodes) {
        yield node;
        if (node.isExpanded && node.children) {
          yield* treeWalker(node.children);
        }
      }
    },
    [nodes]
  );
  
  return (
    <FixedSizeTree
      height={height}
      itemSize={36}
      treeWalker={treeWalker}
    >
      {TreeNode}
    </FixedSizeTree>
  );
}
```

#### 5.2 Web Worker for Validation
```typescript
// workers/validation.worker.ts
import { validate } from '../core/validation';

self.addEventListener('message', async (e) => {
  const { type, payload } = e.data;
  
  if (type === 'VALIDATE_FORM') {
    const errors = await validate(payload);
    self.postMessage({ type: 'VALIDATION_RESULT', errors });
  }
});

// hooks/useValidation.ts
export function useValidation() {
  const workerRef = useRef<Worker>();
  const [errors, setErrors] = useState<ValidationError[]>([]);
  
  useEffect(() => {
    workerRef.current = new Worker('/workers/validation.worker.ts');
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'VALIDATION_RESULT') {
        setErrors(e.data.errors);
      }
    };
    
    return () => workerRef.current?.terminate();
  }, []);
  
  const validate = useCallback((data: FormState) => {
    workerRef.current?.postMessage({ type: 'VALIDATE_FORM', payload: data });
  }, []);
  
  return { validate, errors };
}
```

#### 5.3 Feature Flag & Migration
```typescript
// Migration with feature flag
export function FormEditorPage() {
  const { formId } = Route.useParams();
  const { data: form } = useQuery(['form', formId], () => api.getForm(formId));
  
  // Feature flag for gradual rollout
  const useNewEditor = localStorage.getItem('newFormEditor') === 'true';
  
  if (useNewEditor) {
    // Initialize Zustand stores with migrated data
    useEffect(() => {
      if (form) {
        const migrated = migrateFromOldFormat(form);
        useFormStore.setState(migrated);
      }
    }, [form]);
    
    return <FormEditor formId={formId} />;
  }
  
  return <OldFormEditor form={form} />;
}
```

## Benefits of This Approach

### Performance
- **O(1) Operations**: Direct node access via normalized structure
- **Selective Re-renders**: Zustand's granular subscriptions
- **Virtual Scrolling**: Handles thousands of nodes smoothly
- **Web Workers**: Validation doesn't block UI
- **Optimistic Updates**: Instant feedback with reconciliation

### Developer Experience
- **50% Less Boilerplate**: Zustand vs useReducer
- **No Provider Hell**: Direct store access
- **Built-in DevTools**: Redux DevTools support
- **Type Safety**: Discriminated unions prevent errors
- **Undo/Redo**: Command pattern makes it trivial

### Maintainability
- **Clear Separation**: Domain logic separate from UI
- **Event-Driven**: Loose coupling between components
- **Testable Commands**: Each operation is isolated
- **Small Components**: Most under 100 lines

### Extensibility
- **Plugin Architecture**: Easy to add new node types
- **Command Pattern**: New operations without touching core
- **Event Bus**: Cross-cutting concerns without coupling

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 2 days | Zustand stores & command pattern |
| Phase 2 | 1 day | UI store & event system |
| Phase 3 | 2 days | Component implementation |
| Phase 4 | 1 day | Optimistic autosave |
| Phase 5 | 2 days | Performance optimizations |
| Phase 6 | 2 days | Testing & migration |
| **Total** | **10 days** | **Production-ready editor** |

## Success Criteria

- [ ] All components under 150 lines
- [ ] Zustand stores replace all useState/useReducer
- [ ] O(1) node operations via normalization
- [ ] Command pattern enables undo/redo
- [ ] Virtual scrolling handles 1000+ nodes
- [ ] Web Workers for non-blocking validation
- [ ] Optimistic updates with reconciliation
- [ ] Event-driven architecture for extensibility
- [ ] Zero breaking changes to API
- [ ] Feature flag enables gradual rollout
- [ ] 50% reduction in total LOC
- [ ] Sub-100ms response for all operations

## Conclusion

This rewrite creates the most elegant possible solution by:
1. **Zustand** eliminates boilerplate and provider hell
2. **Normalized state** ensures O(1) operations
3. **Command pattern** enables undo/redo and testing
4. **Event-driven architecture** provides extensibility
5. **Performance optimizations** handle scale

The result is a form editor that's not just functional, but genuinely elegant—a joy to work with, extend, and maintain.