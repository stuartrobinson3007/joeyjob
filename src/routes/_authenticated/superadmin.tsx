import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/superadmin')({
  staticData: {
    skipOrgCheck: true, // Superadmin routes operate across all organizations
  },
  component: SuperAdminPage,
})

function SuperAdminPage() {
  // Use our SuperAdminLayout component which has purple sidebar
  return <Outlet />
}
