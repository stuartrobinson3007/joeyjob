# Full Implementation Plan: Reusable TanStack Table with Advanced Filtering

## Phase 1: Core Data Table Infrastructure

### 1. Create base TanStack Table setup
- Build `DataTable` component with TanStack Table v8 integration
- Configure for server-side operations (manualFiltering, manualSorting, manualPagination)
- Store filter state in table's internal state (not URL)
- Add column meta support for filter configurations

### 2. Implement filter components from shadcn-table
- Port `DataTableFacetedFilter` for badge-based multi-select filters
- Port `DataTableDateFilter` for date range filtering
- Port `DataTableNumberFilter` with slider support
- Create search input component
- All components will use `column.setFilterValue()` to update TanStack state

## Phase 2: Server Functions & Query Integration

### 3. Enhance server functions for filtering/pagination
- Update `getTodos` to accept filter/sort/pagination params
- Add Drizzle query builders for dynamic filtering
- Support operators: equals, contains, between, in array
- Return total count for pagination

### 4. Integrate TanStack Query
- Create `useTableQuery` hook combining Query with Table state
- Implement debounced filter updates
- Handle loading states and optimistic updates
- Cache management for filtered results

## Phase 3: Reusable Configuration System

### 5. Build column configuration system
- Define filter types: text, number, date, select, multi-select
- Column meta properties for filter config
- Type-safe column definitions with Zod schemas
- Auto-detect filter type from data type

### 6. Create DataTableToolbar component
- Dynamic filter rendering based on column config
- Search bar with global filter support
- Sort indicators and controls
- Reset filters button

## Phase 4: Complete Integration

### 7. Add pagination controls
- Server-side pagination with TanStack Query
- Page size selector
- Total count display
- Keyboard navigation support

### 8. Polish and optimize
- Loading skeletons during fetch
- Empty states
- Error boundaries
- Performance optimizations (memoization, virtualization for large datasets)

## Key Technical Decisions

- **State Management**: Use TanStack Table's internal state (no URL params)
- **Server Communication**: TanStack Start's `createServerFn` with TanStack Query
- **UI Components**: Adapt shadcn-table UI but integrate with existing taali-ui components
- **Type Safety**: Full TypeScript with Zod validation schemas
- **Filter Storage**: Column meta properties for configuration, table state for values

## File Structure

```
src/
├── components/
│   ├── data-table/
│   │   ├── data-table.tsx (main table component)
│   │   ├── data-table-toolbar.tsx (search + filters)
│   │   ├── data-table-faceted-filter.tsx (badge filters)
│   │   ├── data-table-date-filter.tsx
│   │   ├── data-table-number-filter.tsx
│   │   ├── data-table-pagination.tsx
│   │   └── types.ts (filter configs, column meta)
│   └── taali-ui/ui/ (existing components)
├── lib/
│   ├── hooks/
│   │   └── use-table-query.ts (Query + Table integration)
│   └── utils/
│       └── table-filters.ts (filter builders for Drizzle)
└── features/
    └── todos/
        └── lib/
            └── todos.server.ts (enhanced with filters)
```

## Current Status

### ✅ Completed
- Created all data-table components
- Implemented filter components (faceted, date, number)
- Built useTableQuery hook
- Created server function with filtering support
- Added pagination component

### ❌ Issues to Fix
1. **Filters not showing**: The DataTableToolbar needs to properly render filters based on column meta
2. **Sorting not working**: Need to add sort handlers to column headers
3. **Server-side integration**: Ensure server functions are properly receiving and processing filter/sort/pagination params
4. **State synchronization**: Table state needs to properly sync with server queries

## Next Steps
1. Debug why filters aren't appearing in the toolbar
2. Verify server function is receiving correct parameters
3. Ensure column meta properties are properly configured
4. Add proper sorting indicators and handlers
5. Test all filter types with actual data