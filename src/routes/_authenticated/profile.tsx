import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { ArrowLeft, Mail, User, Shield, Calendar, Edit2, Save, X, Monitor, Smartphone, AlertCircle, Globe, Clock, Trash2, ShieldAlert } from 'lucide-react'
import { useSession, useListSessions, useRevokeSession, useRevokeOtherSessions } from '@/lib/auth/auth-hooks'
import { authClient } from '@/lib/auth/auth-client'
import { Button } from '@/components/taali-ui/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/taali-ui/ui/card'
import { Input } from '@/components/taali-ui/ui/input'
import { Label } from '@/components/taali-ui/ui/label'
import { AvatarUploadDialog } from '@/components/avatar-upload-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/taali-ui/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/taali-ui/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/taali-ui/ui/alert-dialog'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/profile')({
  staticData: {
    sidebar: false
  },
  component: ProfileScreen
})

function ProfileScreen() {
  const { data: session, isPending } = useSession()
  const { data: sessions, isPending: isLoadingSessions, refetch: refetchSessions } = useListSessions()
  const revokeSessionMutation = useRevokeSession()
  const revokeOtherSessionsMutation = useRevokeOtherSessions()
  
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  })
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [sessionToRevoke, setSessionToRevoke] = useState<any>(null)
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = useState(false)


  const user = session?.user

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
      email: user.email
    })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setFormData({
      firstName: '',
      lastName: '',
      email: ''
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await authClient.updateUser({
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email
      })
      toast.success('Profile updated successfully')
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevokeSession = (sessionItem: any) => {
    setSessionToRevoke(sessionItem)
    setRevokeDialogOpen(true)
  }

  const confirmRevokeSession = async () => {
    if (!sessionToRevoke) return
    
    try {
      await revokeSessionMutation.mutateAsync({
        token: sessionToRevoke.token
      })
      toast.success('Session revoked successfully')
      await refetchSessions()
    } catch (error) {
      console.error('Failed to revoke session:', error)
      toast.error('Failed to revoke session')
    } finally {
      setRevokeDialogOpen(false)
      setSessionToRevoke(null)
    }
  }

  const handleRevokeAllOtherSessions = async () => {
    try {
      await revokeOtherSessionsMutation.mutateAsync()
      toast.success('All other sessions revoked successfully')
      await refetchSessions()
    } catch (error) {
      console.error('Failed to revoke sessions:', error)
      toast.error('Failed to revoke sessions')
    } finally {
      setRevokeAllDialogOpen(false)
    }
  }

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase()
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-4 w-4" />
    }
    return <Monitor className="h-4 w-4" />
  }

  const parseUserAgent = (userAgent: string) => {
    const ua = userAgent.toLowerCase()
    let browser = 'Unknown Browser'
    let os = 'Unknown OS'
    
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

  const isCurrentSession = (sessionItem: any) => {
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
            <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account information and preferences</p>
        </div>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details and account information</CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
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
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            placeholder="Enter first name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            placeholder="Enter last name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="Enter email address"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSave} disabled={isSaving}>
                          <Save className="h-4 w-4 mr-2" />
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Full Name</Label>
                        <p className="text-lg font-medium">{getUserDisplayName()}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Email</Label>
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
              <CardTitle>Account Details</CardTitle>
              <CardDescription>View your account status and metadata</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-muted-foreground">User ID</Label>
                </div>
                <p className="font-mono text-sm">{user.id}</p>
              </div>
              {user.role && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-muted-foreground">Role</Label>
                  </div>
                  <p className="capitalize">{user.role}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-muted-foreground">Account Created</Label>
                </div>
                <p>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-muted-foreground">Email Verified</Label>
                </div>
                <p>{user.emailVerified ? 'Yes' : 'No'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your account security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    {user.twoFactorEnabled
                      ? 'Two-factor authentication is enabled for your account'
                      : 'Add an extra layer of security to your account'}
                  </p>
                </div>
                <Button variant="outline" disabled>
                  {user.twoFactorEnabled ? 'Manage' : 'Enable'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-muted-foreground">Update your password regularly for better security</p>
                </div>
                <Button variant="outline" disabled>
                  Change
                </Button>
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Active Sessions</AlertTitle>
              <AlertDescription>
                View and manage all devices that are currently signed in to your account. The current session is highlighted and cannot be revoked.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sessions</CardTitle>
                    <CardDescription>Manage your active sessions across different devices</CardDescription>
                  </div>
                  {sessions && sessions.length > 1 && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setRevokeAllDialogOpen(true)}
                      disabled={revokeOtherSessionsMutation.isPending}
                    >
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      Revoke All Other Sessions
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingSessions ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : !sessions || sessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No active sessions found</p>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((sessionItem) => {
                      const isCurrent = isCurrentSession(sessionItem)
                      return (
                        <div
                          key={sessionItem.token}
                          className={`relative flex items-center justify-between p-4 rounded-lg border transition-colors ${
                            isCurrent 
                              ? 'bg-primary/5 border-primary/50 ring-2 ring-primary/20' 
                              : 'bg-card hover:bg-accent/5'
                          }`}
                        >
                          {isCurrent && (
                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-r" />
                          )}
                          <div className="flex items-start gap-4">
                            <div className={`mt-1 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                              {getDeviceIcon(sessionItem.userAgent || '')}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {parseUserAgent(sessionItem.userAgent || 'Unknown Device')}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    Created: {sessionItem.createdAt 
                                      ? new Date(sessionItem.createdAt).toLocaleString() 
                                      : 'Unknown'}
                                  </span>
                                </div>
                              </div>
                              {sessionItem.expiresAt && (
                                <p className="text-xs text-muted-foreground">
                                  Expires: {new Date(sessionItem.expiresAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center">
                            {isCurrent ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                Current Session
                              </span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeSession(sessionItem)}
                                disabled={revokeSessionMutation.isPending}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
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
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Security Notice</AlertTitle>
                <AlertDescription>
                  If you notice any unfamiliar devices or locations, revoke those sessions immediately and change your password.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke Session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will sign out the device from your account. The user will need to sign in again to access your account.
                {sessionToRevoke && (
                  <div className="mt-4 p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium">
                      {parseUserAgent(sessionToRevoke.userAgent || 'Unknown Device')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      IP: {sessionToRevoke.ipAddress || 'Unknown'}
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRevokeSession}>
                Revoke Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={revokeAllDialogOpen} onOpenChange={setRevokeAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke All Other Sessions?</AlertDialogTitle>
              <AlertDialogDescription>
                This will sign out all other devices from your account except the current one. All users will need to sign in again to access your account.
                <Alert className="mt-4" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    This action cannot be undone. Make sure you recognize the current device before proceeding.
                  </AlertDescription>
                </Alert>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevokeAllOtherSessions}>
                Revoke All Other Sessions
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}