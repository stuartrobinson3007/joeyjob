import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Navigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { SuperadminPasswordChallenge } from '@/features/admin/components/superadmin-password-challenge'
import { SuperadminSignIn } from '@/features/admin/components/superadmin-sign-in'
import { useSession } from '@/lib/auth/auth-hooks'

export const Route = createFileRoute('/_all-pages/superadmin/signin')({
  component: SuperadminSignInPage,
})

function SuperadminSignInPage() {
  const { data: session, isPending } = useSession()
  const [isPasswordVerified, setIsPasswordVerified] = useState(false)
  

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  // If already signed in as superadmin, redirect to dashboard
  if (session?.user?.role === 'superadmin') {
    return <Navigate to="/superadmin" />
  }

  // Wrap everything in a div with CSS variable overrides for purple theme
  return (
    <div className="
      min-h-screen
      [--primary:theme(colors.purple.600)]
      [--primary-foreground:theme(colors.white)]
      [--ring:theme(colors.purple.500)]
      [--accent:theme(colors.purple.100)]
      [--accent-foreground:theme(colors.purple.700)]
      [--muted:theme(colors.gray.100)]
      [--muted-foreground:theme(colors.gray.600)]
      [--card:theme(colors.white)]
      [--card-foreground:theme(colors.gray.900)]
      [--border:theme(colors.gray.200)]
      [--input:theme(colors.gray.200)]
      dark:[--primary:theme(colors.purple.500)]
      dark:[--primary-foreground:theme(colors.white)]
      dark:[--ring:theme(colors.purple.400)]
      dark:[--accent:theme(colors.purple.900)]
      dark:[--accent-foreground:theme(colors.purple.100)]
      dark:[--muted:theme(colors.gray.800)]
      dark:[--muted-foreground:theme(colors.gray.400)]
      dark:[--card:theme(colors.gray.900)]
      dark:[--card-foreground:theme(colors.gray.100)]
      dark:[--border:theme(colors.gray.700)]
      dark:[--input:theme(colors.gray.700)]
    ">
      {/* Show password challenge first */}
      {!isPasswordVerified ? (
        <SuperadminPasswordChallenge 
          onSuccess={() => {
            setIsPasswordVerified(true)
          }}
        />
      ) : (
        // Show superadmin sign-in form
        (<SuperadminSignIn />)
      )}
    </div>
  )
}