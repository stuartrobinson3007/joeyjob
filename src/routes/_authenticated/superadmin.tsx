import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/superadmin')({
  component: SuperAdminPage,
})

function SuperAdminPage() {
  // Use our SuperAdminLayout component which has purple sidebar
  return (
    <Outlet />
  )
}