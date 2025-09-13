/**
 * Server-only exports for employee management
 * Only includes server functions that can be called from client components
 * Services should be imported directly where needed to prevent client bundling
 */

// Export server functions (callable from client via RPC)
export {
  syncEmployeesFromProvider,
  getEmployeesForOrganization,
  toggleEmployeeEnabled
} from './employee-management.server'