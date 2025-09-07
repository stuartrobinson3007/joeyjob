/**
 * User Tile Component
 *
 * Displays user information and provides logout functionality.
 * Used in sidebars and admin interfaces.
 */

import { useNavigate, useLocation } from '@tanstack/react-router'
import {
  LogOut,
  User,
  MoreVertical,
  Check,
  Sun,
  Moon,
  Monitor,
  ShieldUser,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/taali-ui/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
} from '@/components/taali-ui/ui/dropdown-menu'
import { SidebarMenuButton } from '@/components/ui/sidebar'

interface UserTileUser {
  id: string
  email?: string
  firstName?: string | null
  lastName?: string | null
  name?: string
  image?: string | null
  role?: string | null
  isSuperAdmin?: boolean
  isImpersonating?: boolean
}

interface UserTileProps {
  user?: UserTileUser | null
  onLogout?: () => void
  isLoggingOut?: boolean
}

// Helper functions
function getUserDisplayName(user: UserTileUser | null | undefined, tCommon: (key: string) => string): string {
  if (!user) return tCommon('labels.user')

  if (user.name) return user.name

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
  if (fullName) return fullName

  return user.email?.split('@')[0] || 'User'
}

function getUserInitials(user: UserTileUser | null | undefined, tCommon: (key: string) => string): string {
  if (!user) return 'U'

  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  }

  const displayName = getUserDisplayName(user, tCommon)
  return displayName.charAt(0).toUpperCase()
}

export function UserTile({ user, onLogout, isLoggingOut = false }: UserTileProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation('admin')
  const { t: tCommon } = useTranslation('common')

  const isSuperAdmin = useMemo(() => user?.role === 'superadmin', [user])
  const isInSuperAdminPanel = useMemo(
    () => location.pathname.startsWith('/superadmin'),
    [location.pathname]
  )

  if (!user) {
    return (
      <div className="flex items-center gap-2 p-2">
        <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
        <div className="flex flex-col gap-1">
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return Sun
      case 'dark':
        return Moon
      case 'system':
        return Monitor
      default:
        return Sun
    }
  }

  const ThemeIcon = getThemeIcon()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <Avatar className="h-6 w-6">
            <AvatarImage src={user.image || undefined} />
            <AvatarFallback>{getUserInitials(user, tCommon)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-left flex-1">
            <span className="text-sm font-medium">{getUserDisplayName(user, tCommon)}</span>
          </div>
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>
          <User />
          {tCommon('navigation.profile')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ThemeIcon className="h-4 w-4 mr-2" />
            {tCommon('theme.title')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Check
                className={`h-4 w-4 mr-2 ${theme === 'light' ? 'opacity-100' : 'opacity-0'}`}
              />
              {tCommon('theme.light')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Check className={`h-4 w-4 mr-2 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`} />
              {tCommon('theme.dark')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Check
                className={`h-4 w-4 mr-2 ${theme === 'system' ? 'opacity-100' : 'opacity-0'}`}
              />
              {tCommon('theme.system')}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Superadmin access - only show if user is superadmin */}
        {isSuperAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (isInSuperAdminPanel) {
                  navigate({ to: '/' })
                } else {
                  navigate({ to: '/superadmin/users' })
                }
              }}
            >
              {isInSuperAdminPanel ? (
                <>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('common:actions.leave')}
                </>
              ) : (
                <>
                  <ShieldUser className="h-4 w-4 mr-2" />
                  {t('title')}
                </>
              )}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} disabled={isLoggingOut || user?.isImpersonating}>
          <LogOut className="h-4 w-4 mr-2" />
          {user?.isImpersonating
            ? t('impersonation.logoutDisabled')
            : isLoggingOut
              ? tCommon('states.signingIn')
              : tCommon('actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
