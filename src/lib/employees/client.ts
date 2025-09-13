/**
 * Client-safe exports for employee management
 * Only includes types and components that can be safely bundled in the client
 */

// Export types (safe for client)
export type { MergedEmployee } from './employee-sync.service'

// Export components (client-only)
export { EmployeeManagementList } from './components/employee-management-list'