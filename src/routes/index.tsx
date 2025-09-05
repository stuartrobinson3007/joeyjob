import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useSession } from '@/lib/auth/auth-hooks'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // If authenticated, redirect to org page
  if (session) {
    return <Navigate to="/todos" />
  }

  // If not authenticated, redirect to sign in
  return <Navigate to="/auth/signin" />
}
