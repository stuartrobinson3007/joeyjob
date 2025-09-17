import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { formatDate, formatDateTime } from '@/taali/utils/date'
import {
  ArrowLeft,
  Mail,
  User,
  Shield,
  Calendar,
  Edit2,
  Save,
  X,
  Monitor,
  Smartphone,
  AlertCircle,
  Clock,
  Trash2,
  ShieldAlert,
  Loader2,
  Languages,
  Check,
} from 'lucide-react'

interface SessionItem {
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt?: Date | string
  expiresAt?: Date | string
}

import {
  useSession,
  useListSessions,
  useRevokeSession,
  useRevokeOtherSessions,
} from '@/lib/auth/auth-hooks'
import { authClient } from '@/lib/auth/auth-client'
import { Button } from '@/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/card'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { AvatarUploadDialog } from '@/components/avatar-upload-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/alert-dialog'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useLanguage } from '@/taali/i18n/hooks/useLanguage'
import { useErrorHandler } from '@/lib/errors/hooks'

export const Route = createFileRoute('/_authenticated/profile')({
  staticData: {
    sidebar: false,
  },
  component: ProfileScreen,
})

function ProfileScreen() {
  const { data: session, isPending } = useSession()
  const {
    data: sessions,
    isPending: isLoadingSessions,
    refetch: refetchSessions,
  } = useListSessions()
  const revokeSessionMutation = useRevokeSession()
  const revokeOtherSessionsMutation = useRevokeOtherSessions()
  const { activeOrganization } = useActiveOrganization()
  const { t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')
  const { t: tAdmin } = useTranslation('admin')
  const { language, languages, changeLanguage, isReady } = useLanguage({
    user: session?.user ? { language: session.user.language || undefined } : null,
    onLanguageChange: async (lang) => {
      await authClient.updateUser({ language: lang })
    }
  })
  const { showError, showSuccess } = useErrorHandler()

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  })
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [sessionToRevoke, setSessionToRevoke] = useState<SessionItem | null>(null)
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = useState(false)

  const user = session?.user

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const getUserDisplayName = () => {
    if (user.name) return user.name
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
    if (fullName) return fullName
    return user.email.split('@')[0]
  }

  const handleEdit = () => {
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
    })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await authClient.updateUser({
        name: `${formData.firstName} ${formData.lastName}`.trim(),
      })
      showSuccess(t('messages.profileUpdated'))
      setIsEditing(false)
    } catch (error) {
      showError(error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevokeSession = (sessionItem: SessionItem) => {
    setSessionToRevoke(sessionItem)
    setRevokeDialogOpen(true)
  }

  const confirmRevokeSession = async () => {
    if (!sessionToRevoke) return

    try {
      await revokeSessionMutation.mutateAsync({
        token: sessionToRevoke.token,
      })
      showSuccess(t('messages.sessionRevoked'))
      await refetchSessions()
    } catch (error) {
      showError(error)
    } finally {
      setRevokeDialogOpen(false)
      setSessionToRevoke(null)
    }
  }

  const handleRevokeAllOtherSessions = async () => {
    try {
      await revokeOtherSessionsMutation.mutateAsync({})
      showSuccess(t('messages.allSessionsRevoked'))
      await refetchSessions()
    } catch (error) {
      showError(error)
    } finally {
      setRevokeAllDialogOpen(false)
    }
  }

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase()
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone />
    }
    return <Monitor />
  }

  const parseUserAgent = (userAgent: string) => {
    const ua = userAgent.toLowerCase()
    let browser: string = 'Unknown'
    let os: string = 'Unknown'

    if (ua.includes('chrome')) browser = 'Chrome'
    else if (ua.includes('firefox')) browser = 'Firefox'
    else if (ua.includes('safari')) browser = 'Safari'
    else if (ua.includes('edge')) browser = 'Edge'

    if (ua.includes('windows')) os = 'Windows'
    else if (ua.includes('mac')) os = 'macOS'
    else if (ua.includes('linux')) os = 'Linux'
    else if (ua.includes('android')) os = 'Android'
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'

    return `${browser} on ${os}`
  }

  const isCurrentSession = (sessionItem: SessionItem) => {
    // BetterAuth: Compare the session tokens directly
    if (!session?.session) return false

    // The session list returns sessions with 'token' field
    // Current session also has 'token' field
    return sessionItem.token === session.session.token
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft />
              {t('backToDashboard')}
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="basic">{t('tabs.basic')}</TabsTrigger>
            <TabsTrigger value="sessions">{t('tabs.sessions')}</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('personalInfo.title')}</CardTitle>
                    <CardDescription>{t('personalInfo.description')}</CardDescription>
                  </div>
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={handleEdit}>
                      <Edit2 />
                      {tCommon('actions.edit')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-6">
                  <AvatarUploadDialog
                    currentAvatarUrl={user.image}
                    userName={getUserDisplayName()}
                  />

                  <div className="flex-1 space-y-4">
                    {isEditing ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">{t('personalInfo.firstName')}</Label>
                            <Input
                              id="firstName"
                              value={formData.firstName}
                              onChange={e =>
                                setFormData({ ...formData, firstName: e.target.value })
                              }
                              placeholder={t('personalInfo.firstNamePlaceholder')}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">{t('personalInfo.lastName')}</Label>
                            <Input
                              id="lastName"
                              value={formData.lastName}
                              onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                              placeholder={t('personalInfo.lastNamePlaceholder')}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">{t('personalInfo.email')}</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder={t('personalInfo.emailPlaceholder')}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSave} disabled={isSaving}>
                            <Save />
                            {isSaving ? tCommon('states.sending') : tCommon('actions.save')}
                          </Button>
                          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                            <X />
                            {tCommon('actions.cancel')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            {t('personalInfo.fullName')}
                          </Label>
                          <p className="text-lg font-medium">{getUserDisplayName()}</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">{t('personalInfo.email')}</Label>
                          <p className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {user.email}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('account.title')}</CardTitle>
                <CardDescription>{t('account.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-muted-foreground">{t('account.userId')}</Label>
                  </div>
                  <p className="font-mono text-sm">{user.id}</p>
                </div>
                {user.role && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-muted-foreground">{t('account.role')}</Label>
                    </div>
                    <p className="capitalize">{user.role}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-muted-foreground">{t('account.accountCreated')}</Label>
                  </div>
                  <p>
                    {user.createdAt
                      ? formatDate(user.createdAt, 'MMM d, yyyy', undefined, activeOrganization?.timezone)
                      : tCommon('table.notAvailable')}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-muted-foreground">{t('account.emailVerified')}</Label>
                  </div>
                  <p>{user.emailVerified ? tCommon('boolean.yes') : tCommon('boolean.no')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('preferences.title')}</CardTitle>
                <CardDescription>{t('preferences.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-muted-foreground">{t('preferences.language')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {isReady && languages[language] && (
                      <>
                        <span>{languages[language].flag}</span>
                        <span>{languages[language].name}</span>
                      </>
                    )}
                  </div>
                </div>
                {isReady && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(languages).map(([code, info]) => (
                      <Button
                        key={code}
                        variant={language === code ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => changeLanguage(code as 'en' | 'es')}
                        className="flex items-center gap-2"
                      >
                        {language === code && <Check className="h-3 w-3" />}
                        <span>{info.flag}</span>
                        <span>{info.name}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('security.title')}</CardTitle>
                <CardDescription>{t('security.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t('security.changePassword')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('security.passwordDescription')}
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    {tCommon('actions.edit')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <Alert>
              <AlertCircle />
              <AlertTitle>{t('sessions.title')}</AlertTitle>
              <AlertDescription>{t('sessions.alertDescription')}</AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('sessions.subtitle')}</CardTitle>
                    <CardDescription>{t('sessions.description')}</CardDescription>
                  </div>
                  {sessions && sessions.length > 1 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setRevokeAllDialogOpen(true)}
                      disabled={revokeOtherSessionsMutation.isPending}
                    >
                      <ShieldAlert />
                      {t('sessions.revokeAll')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingSessions ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                ) : !sessions || sessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t('sessions.empty')}</p>
                ) : (
                  <div className="space-y-4">
                    {sessions.map(sessionItem => {
                      const isCurrent = isCurrentSession(sessionItem)
                      return (
                        <div
                          key={sessionItem.token}
                          className={`relative flex items-center justify-between p-4 rounded-lg border transition-colors ${isCurrent
                            ? 'bg-primary/5 border-primary/50 ring-2 ring-primary/20'
                            : 'bg-card hover:bg-accent/5'
                            }`}
                        >
                          {isCurrent && (
                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-r" />
                          )}
                          <div className="flex items-start gap-4">
                            <div
                              className={`mt-1 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}
                            >
                              {getDeviceIcon(sessionItem.userAgent || '')}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {parseUserAgent(
                                    sessionItem.userAgent || t('sessions.unknownDevice')
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {tAdmin('sessions.created')}
                                    {': '}
                                    {sessionItem.createdAt
                                      ? formatDateTime(sessionItem.createdAt, 'MMM d, yyyy h:mm a', activeOrganization?.timezone)
                                      : t('sessions.unknown')}
                                  </span>
                                </div>
                              </div>
                              {sessionItem.expiresAt && (
                                <p className="text-xs text-muted-foreground">
                                  {t('sessions.expiresLabel')}{' '}
                                  {formatDateTime(sessionItem.expiresAt, 'MMM d, yyyy h:mm a', activeOrganization?.timezone)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center">
                            {isCurrent ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                {t('sessions.current')}
                              </span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeSession(sessionItem)}
                                disabled={revokeSessionMutation.isPending}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {sessions && sessions.length > 0 && (
              <Alert variant="destructive">
                <ShieldAlert />
                <AlertTitle>{t('security.notice')}</AlertTitle>
                <AlertDescription>{t('security.securityNoticeDescription')}</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('security.revokeSessionTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('security.revokeAllSessionsDescription')}
                {sessionToRevoke && (
                  <div className="mt-4 p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium">
                      {parseUserAgent(sessionToRevoke.userAgent || t('sessions.unknownDevice'))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('sessions.ipAddress')} {sessionToRevoke.ipAddress || t('sessions.unknown')}
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRevokeSession}>
                {t('security.revokeSessionAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={revokeAllDialogOpen} onOpenChange={setRevokeAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('security.revokeAllTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('security.revokeAllSessionsDescription')}
                <Alert className="mt-4" variant="destructive">
                  <AlertCircle />
                  <AlertTitle>{t('security.warning')}</AlertTitle>
                  <AlertDescription>{t('security.revokeWarning')}</AlertDescription>
                </Alert>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevokeAllOtherSessions}>
                {t('sessions.revokeAllOthers')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
