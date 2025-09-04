import { Button } from '@stuartrobinson3007/taali-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@stuartrobinson3007/taali-ui/card'
import { authClient } from '@/lib/auth-client'

export function SessionDisplay() {
  const { data: session, isPending } = authClient.useSession()

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
    } catch (error) {
      console.error('Sign-out failed:', error)
    }
  }

  if (isPending) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return <div>No session found</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">User</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(session.user, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Session</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(session.session, null, 2)}
            </pre>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleSignOut} variant="destructive">
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}