// Hierarchical query key structure for bookings
export const bookingKeys = {
  // All bookings queries for an organization
  all: (organizationId: string) => ['bookings', organizationId] as const,
  
  // All table queries
  tables: (organizationId: string) => [...bookingKeys.all(organizationId), 'table'] as const,
  
  // Specific table query with filters
  table: (organizationId: string, filters?: Record<string, unknown>) => 
    [...bookingKeys.tables(organizationId), filters] as const,
  
  // All list queries
  lists: (organizationId: string) => [...bookingKeys.all(organizationId), 'list'] as const,
  
  // Specific list query with filters
  list: (organizationId: string, filters?: Record<string, unknown>) => 
    [...bookingKeys.lists(organizationId), filters] as const,
  
  // All detail queries
  details: (organizationId: string) => [...bookingKeys.all(organizationId), 'detail'] as const,
  
  // Specific booking detail
  detail: (organizationId: string, bookingId: string) => 
    [...bookingKeys.details(organizationId), bookingId] as const,
}