import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_org-required/team')({
  component: Team,
})

function Team() {
  // Team functionality is disabled in single-user mode
  // Redirect to dashboard
  return <Navigate to="/" />
}