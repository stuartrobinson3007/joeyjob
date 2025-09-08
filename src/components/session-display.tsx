import { Loader2 } from 'lucide-react'

import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { authClient } from '@/lib/auth/auth-client'
import { useSession } from '@/lib/auth/auth-hooks'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export function SessionDisplay() {
  const { data: session, isPending } = useSession()
  const { t: tCommon } = useTranslation('common')
  const { t: tProfile } = useTranslation('profile')

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
    } catch (_error) {
      // Sign-out error is not critical - user will be redirected anyway
    }
  }

  if (isPending) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <div>{tProfile('sessions.notFound')}</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{tProfile('sessions.information')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">{tCommon('labels.user')}</h3>
            <pre className="bg-muted p-3 rounded text-sm overflow-auto">
              {JSON.stringify(session.user, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">{tProfile('sessions.session')}</h3>
            <pre className="bg-muted p-3 rounded text-sm overflow-auto">
              {JSON.stringify(session.session, null, 2)}
            </pre>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleSignOut} variant="destructive">
              {tCommon('actions.signOut')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
