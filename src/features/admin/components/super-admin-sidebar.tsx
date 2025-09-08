/**
 * Super Admin Sidebar
 *
 * Navigation sidebar specifically for super admin interface.
 * Contains superadmin-specific navigation items and controls using better-auth.
 */

import { useState } from 'react'
import { useRouter, useRouterState, Link } from '@tanstack/react-router'
import { Users, Building2, ShieldUser, ArrowLeft } from 'lucide-react'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { UserTile } from '@/components/user-tile'
import { authClient } from '@/lib/auth/auth-client'
import { cn } from '@/components/taali-ui/lib/utils'
import { useSession } from '@/lib/auth/auth-hooks'
import { isUserImpersonating } from '@/lib/auth/auth-types'

interface SuperAdminSidebarProps {
  className?: string
}

export function SuperAdminSidebar({ className }: SuperAdminSidebarProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { t } = useTranslation('admin')
  const { t: tAuth } = useTranslation('auth')

  const { data: session } = useSession()
  // Use useRouterState for reactive pathname updates
  const currentPath = useRouterState({
    select: state => state.location.pathname,
  })

  const superAdminNavItems = [
    {
      title: t('users.title'),
      url: '/superadmin/users',
      icon: Users,
    },
    {
      title: t('workspaces.title'),
      url: '/superadmin/workspaces',
      icon: Building2,
    },
  ]

  const handleReturnToApp = () => {
    // Navigate back to the main app - home page
    router.navigate({ to: '/' })
  }

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)

    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            // Clear any superadmin-specific localStorage items
            if (typeof window !== 'undefined') {
              const itemsToClear = [
                'activeOrganizationId',
                'switchToWorkspace',
                'todo_app_superadmin_override_mode', // Clear superadmin override mode on logout
              ]

              itemsToClear.forEach(item => {
                try {
                  localStorage.removeItem(item)
                } catch (_error) {
                  // Silently ignore localStorage clear errors
                }
              })

              // Clear session storage
              try {
                sessionStorage.clear()
              } catch (_error) {
                // Silently ignore sessionStorage clear errors
              }
            }

            // Navigate to signin
            router.navigate({
              to: '/auth/signin',
              search: {
                message: tAuth('logout.success'),
                type: 'info',
              },
            })
          },
          onError: _error => {
            // Logout error is handled - just reset loading state
            setIsLoggingOut(false)
          },
        },
      })
    } catch (_error) {
      // Logout error is handled - just reset loading state
      setIsLoggingOut(false)
    }
  }

  const user = session?.user
  const isImpersonating = isUserImpersonating(session)

  return (
    <Sidebar className={cn('border-r', className)}>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <ShieldUser className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-bold text-sidebar-foreground">{t('title')}</h2>
              <p className="text-sm text-muted-foreground">{t('sidebar.subtitle')}</p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {superAdminNavItems.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-0" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleReturnToApp}>
                  <ArrowLeft />
                  <span>{t('actions.leave')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserTile
              user={user ? { ...user, isImpersonating } : user}
              onLogout={handleLogout}
              isLoggingOut={isLoggingOut}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
