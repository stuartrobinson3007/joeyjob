# DataTable Improvements Plan

## Overview
This document outlines the improvements needed to make DataTable components maximally reusable and consistent across all implementations.

## 1. Clean Up SearchConfig Interface

### Current Issue
- `DataTableSearchConfig` interface has unused `columnId: string` property
- All tables use global search but the type still references column-specific search

### Changes Required
**File:** `src/components/taali-ui/data-table/types.ts`
```typescript
// Before
export interface DataTableSearchConfig {
  placeholder?: string
  columnId: string  // <-- Remove this
}

// After
export interface DataTableSearchConfig {
  placeholder?: string
}
```

## 2. Extract Reusable TableHeader Component

### Current Issue
Each table defines its own `TableHeader` component with nearly identical code:
- Teams: lines 203-222
- Users: lines 147-166  
- Workspaces: lines 67-86
- Todos: lines 206-215

### Changes Required
**New File:** `src/components/taali-ui/data-table/data-table-header.tsx`
```typescript
import { Button } from "../ui/button"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

interface DataTableHeaderProps {
  column: any
  children: React.ReactNode
  sortable?: boolean
}

export function DataTableHeader({ column, children, sortable = false }: DataTableHeaderProps) {
  if (!sortable || !column.getCanSort()) {
    return <span className="font-medium">{children}</span>
  }

  const sortDirection = column.getIsSorted()
  
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sortDirection === "asc")}
      className="h-auto px-2 py-1 -ml-2 hover:bg-accent hover:text-accent-foreground"
    >
      {children}
      <div className="ml-2 h-4 w-4">
        {sortDirection === "asc" ? (
          <ArrowUp className="h-4 w-4" />
        ) : sortDirection === "desc" ? (
          <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </Button>
  )
}
```

**Update all tables to import and use:**
```typescript
import { DataTableHeader } from '@/components/taali-ui/data-table'

// In column definitions:
header: ({ column }) => (
  <DataTableHeader column={column} sortable>
    Title
  </DataTableHeader>
)
```

## 3. Standardize Column Widths

### Current Issue
- Todos table uses `size` property for column widths
- Other tables don't specify widths consistently
- Column resizing behavior is inconsistent

### Changes Required
Add `size` property to all column definitions:

**Teams table columns:**
- member: 300
- email: 250
- role: 120
- status: 100
- joinedAt: 150
- actions: 50

**Users table columns:**
- user: 300
- role: 120
- status: 100
- createdAt: 150
- actions: 50

**Workspaces table columns:**
- organization: 300
- memberCount: 120
- createdAt: 150
- status: 100
- actions: 50

## 4. Remove Debug Console Logs

### Files to Clean
Remove all console.log statements from:
- `src/features/admin/lib/admin-users.server.ts` (lines 40, 49, 50, 54, 83, 109, 149)
- `src/features/admin/lib/admin-workspaces.server.ts` (lines 38, 47, 48, 52, 82, 94, 104, 149, 173)
- `src/lib/utils/table-filters.ts` (lines 123, 149)
- `src/components/taali-ui/data-table/data-table.tsx` (line 220)
- `src/features/todos/lib/todos-table.server.ts` (lines 93-101)

## 5. Improve Type Exports

### Current Issue
- `ServerQueryParams` and `ServerQueryResponse` should be exported from index
- Common patterns should be documented

### Changes Required
**File:** `src/components/taali-ui/data-table/index.ts`
```typescript
// Export all types
export type {
  DataTableConfig,
  DataTableColumnMeta,
  DataTableFilterConfig,
  DataTableSearchConfig,
  DataTablePaginationConfig,
  DataTableSelectionConfig,
  DataTableResizingConfig,
  ServerQueryParams,
  ServerQueryResponse,
  SelectionState,
  BulkAction,
  FilterOperator,
  FilterValue
} from './types'
```

## 6. Optimize Performance

### Current Issue
- Missing memoization in some components
- Skeleton rows hardcoded to 5
- No configuration for loading states

### Changes Required

**Add to DataTableConfig:**
```typescript
export interface DataTableConfig<TData> {
  // ... existing properties
  loadingConfig?: {
    skeletonRowCount?: number  // Default: 5
    showSkeletonOnRefetch?: boolean  // Default: false
  }
}
```

**Update DataTable component:**
```typescript
const {
  loadingConfig = {
    skeletonRowCount: 5,
    showSkeletonOnRefetch: false
  }
} = config

// In TableBody:
{isLoading ? (
  Array.from({ length: loadingConfig.skeletonRowCount }).map((_, rowIndex) => (
    // ... skeleton rows
  ))
) : (
  // ... actual data
)}
```

## 7. Standardize Filter Processing

### Current Issue
- Boolean filter handling is inconsistent
- Date filter processing varies between tables

### Changes Required

**Create standard filter preprocessor:**
```typescript
// In table-filters.ts
export function preprocessFilterValue(columnId: string, value: any): any {
  // Handle boolean columns
  if (['completed', 'banned', 'status', 'emailVerified'].includes(columnId)) {
    return value === 'true' || value === true
  }
  
  // Handle date columns
  if (['createdAt', 'updatedAt', 'dueDate', 'joinedAt'].includes(columnId)) {
    return parseFilterValue(value)
  }
  
  return value
}
```

**Update all server functions to use preprocessor:**
```typescript
const processedValue = preprocessFilterValue(columnId, filterValue)
const filter = buildColumnFilter({
  column,
  operator,
  value: processedValue
})
```

## Implementation Order

1. **Phase 1: Type cleanup** (Low risk, high impact)
   - Clean up SearchConfig interface
   - Improve type exports

2. **Phase 2: Component extraction** (Medium risk, high impact)
   - Extract DataTableHeader component
   - Update all tables to use it

3. **Phase 3: Standardization** (Low risk, medium impact)
   - Add column sizes
   - Remove console logs
   - Standardize filter processing

4. **Phase 4: Performance** (Low risk, low impact)
   - Add loading configuration
   - Optimize memoization

## Testing Checklist

After implementation, verify:
- [ ] All tables render correctly
- [ ] Search functionality works
- [ ] Sorting works consistently
- [ ] Filters apply correctly
- [ ] Column resizing works
- [ ] Loading states display properly
- [ ] No console errors or warnings
- [ ] TypeScript compilation succeeds