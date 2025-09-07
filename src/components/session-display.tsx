import { Loader2 } from 'lucide-react'

import { Button } from '@/components/taali-ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/taali-ui/ui/card'
import { authClient } from '@/lib/auth/auth-client'
import { useSession } from '@/lib/auth/auth-hooks'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export function SessionDisplay() {
  const { data: session, isPending } = useSession()
  const { t } = useTranslation('profile')

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
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <div>{t('auth:sessions.notFound')}</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('auth:sessions.information')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">{t('common:labels.user')}</h3>
            <pre className="bg-muted p-3 rounded text-sm overflow-auto">
              {JSON.stringify(session.user, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">{t('auth:sessions.session')}</h3>
            <pre className="bg-muted p-3 rounded text-sm overflow-auto">
              {JSON.stringify(session.session, null, 2)}
            </pre>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleSignOut} variant="destructive">
              {t('common:actions.signOut')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
