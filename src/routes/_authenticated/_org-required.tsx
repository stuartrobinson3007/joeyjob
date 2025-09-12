import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_org-required')({
  beforeLoad: async ({ location }) => {
    console.log('🔄 [DEBUG] _org-required beforeLoad for:', location.pathname)
    
    // For now, let's use a simpler approach that works with the client-side flow
    // The organization middleware pattern should handle the organization ID passing
    
    // We'll defer the organization onboarding check to the organization middleware
    // which is designed to work with client-side organization selection
    
    console.log('✅ [DEBUG] _org-required beforeLoad completed - deferring to organization middleware')
    
    return {}
  },
  component: () => <Outlet />, // Just pass through to child routes
})