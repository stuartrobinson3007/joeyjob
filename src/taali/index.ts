// Taali Library - Reusable utilities, components, and hooks
// Export all public APIs

// Utilities
export * from './utils/type-safe-access'
export * as TableFilters from './utils/table-filters' // Namespace to avoid conflicts
export { cn } from './lib/utils'

// Error System
export * from './errors/codes'
export * from './errors/client-handler'
export { createQueryClient } from './errors/query-client'

// Hooks
export * from './hooks/use-loading-state'
export * from './hooks/use-form-autosave'
export * from './hooks/use-async-field-validator'
export * from './hooks/use-resource-query'
export * from './hooks/use-supporting-query'
export * from './hooks/use-sticky-state'
export * from './hooks/use-table-query'

// Validation
export * from './validation/validation-messages'
export * from './validation/validation-registry'

// Components - Form
export * from './components/form'

// Components - Data Table (has its own filter types)
export * from './components/data-table'

// Components - UI (re-exported for convenience)
export * from './components/ui/button'
export * from './components/ui/input'
export * from './components/ui/badge'
export * from './components/ui/dialog'
export * from './components/ui/dropdown-menu'
export * from './components/ui/select'
export * from './components/ui/table'

// Library utilities
export * from './lib/compose-refs'