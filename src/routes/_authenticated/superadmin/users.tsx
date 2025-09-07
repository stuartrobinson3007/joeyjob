import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { authClient } from '@/lib/auth/auth-client'
import { toast } from 'sonner'
import { Ban, UserCheck, Eye, MoreHorizontal, LogOut, Monitor, X, User, Shield, Trash2 } from 'lucide-react'
import { Badge } from '@/components/taali-ui/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/taali-ui/ui/dropdown-menu'
import { Button } from '@/components/taali-ui/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/taali-ui/ui/sheet'
import { DataTable, DataTableHeader, useTableQuery, DataTableConfig, DataTableColumnMeta } from '@/components/taali-ui/data-table'
import { getAdminUsersTable, type AdminUser } from '@/features/admin/lib/admin-users.server'

export const Route = createFileRoute('/_authenticated/superadmin/users')({
  component: SuperAdminUsers,
})

function SuperAdminUsers() {
  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null)
  const [userSessions, setUserSessions] = React.useState<any[]>([])
  const [sessionsLoading, setSessionsLoading] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [currentFilters, setCurrentFilters] = React.useState({})

  // Use the table query hook
  const {
    data,
    totalCount,
    isLoading,
    isFetching,
    onStateChange,
    refetch,
  } = useTableQuery<AdminUser>({
    queryKey: ['admin', 'users', 'table'],
    queryFn: (params) => {
      setCurrentFilters(params)
      return getAdminUsersTable({ data: params })
    },
    enabled: true,
  })

  const handleBanUser = React.useCallback(async (userId: string, banned: boolean) => {
    try {
      await authClient.admin.banUser({
        userId,
        banReason: banned ? 'Admin action' : undefined
      })
      toast.success(banned ? 'User banned' : 'User unbanned')
      refetch()
    } catch (error) {
      toast.error('Failed to update user ban status')
    }
  }, [refetch])

  const handleSetRole = React.useCallback(async (userId: string, role: 'user' | 'admin' | 'superadmin') => {
    try {
      await authClient.admin.setRole({
        userId,
        role
      })
      toast.success('User role updated')
      refetch()
    } catch (error) {
      toast.error('Failed to update user role')
    }
  }, [refetch])

  const handleRevokeUserSessions = React.useCallback(async (userId: string) => {
    try {
      await authClient.admin.revokeUserSessions({
        userId
      })
      toast.success('All user sessions revoked')
      // Reload sessions if we're viewing them
      if (selectedUser && selectedUser.id === userId) {
        loadUserSessions(userId)
      }
    } catch (error) {
      console.error('Failed to revoke user sessions:', error)
      toast.error('Failed to revoke user sessions')
    }
  }, [selectedUser])

  const handleRevokeSession = React.useCallback(async (sessionToken: string) => {
    try {
      await authClient.admin.revokeUserSession({
        sessionToken
      })
      toast.success('Session revoked')
      // Reload sessions for the current user
      if (selectedUser) {
        loadUserSessions(selectedUser.id)
      }
    } catch (error) {
      console.error('Failed to revoke session:', error)
      toast.error('Failed to revoke session')
    }
  }, [selectedUser])

  const loadUserSessions = React.useCallback(async (userId: string) => {
    setSessionsLoading(true)
    try {
      const result = await authClient.admin.listUserSessions({
        userId
      })
      setUserSessions(result.data?.sessions || [])
    } catch (error) {
      console.error('Failed to load user sessions:', error)
      toast.error('Failed to load user sessions')
      setUserSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  const handleViewSessions = React.useCallback(async (user: AdminUser) => {
    setSelectedUser(user)
    setSheetOpen(true)
    await loadUserSessions(user.id)
  }, [loadUserSessions])

  const handleImpersonate = React.useCallback(async (userId: string) => {
    try {
      await authClient.admin.impersonateUser({ userId })
      toast.success('Impersonation started')
      window.location.href = '/'
    } catch (error) {
      toast.error('Failed to impersonate user')
    }
  }, [])


  // Column definitions
  const columns = React.useMemo<ColumnDef<AdminUser>[]>(() => [
    {
      id: "user",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          User
        </DataTableHeader>
      ),
      enableSorting: true,
      size: 300,
      cell: ({ row }) => {
        const user = row.original
        return (
          <div>
            <div className="text-sm font-medium text-foreground">
              {user.name || 'No name'}
            </div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        )
      },
      meta: {
        enableTextTruncation: true,
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Role
        </DataTableHeader>
      ),
      enableColumnFilter: true,
      enableSorting: true,
      size: 120,
      cell: ({ row }) => {
        const user = row.original
        return (
          <Badge
            variant={user.role === 'superadmin' ? 'destructive' : user.role === 'admin' ? 'primary' : 'muted'}
            style="soft"
            startIcon={user.role === 'superadmin' ? <Shield className="w-4 h-4" /> : user.role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
          >
            {user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'User'}
          </Badge>
        )
      },
      meta: {
        filterConfig: {
          type: "select",
          title: "Role",
          options: [
            { label: "User", value: "user" },
            { label: "Admin", value: "admin" },
            { label: "Super Admin", value: "superadmin" },
          ],
        },
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "banned",
      id: "status",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Status
        </DataTableHeader>
      ),
      enableColumnFilter: true,
      enableSorting: true,
      size: 100,
      cell: ({ row }) => {
        const user = row.original
        return user.banned ? (
          <Badge variant="destructive" style="soft">
            Banned
          </Badge>
        ) : (
          <Badge variant="success" style="soft" status>
            Active
          </Badge>
        )
      },
      meta: {
        filterConfig: {
          type: "select",
          title: "Status",
          options: [
            { label: "Active", value: "false" },
            { label: "Banned", value: "true" },
          ],
        },
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Joined
        </DataTableHeader>
      ),
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
      cell: ({ row }) => {
        const user = row.original
        return (
          <span className="text-sm text-muted-foreground">
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        )
      },
      meta: {
        filterConfig: {
          type: "dateRange",
          title: "Joined Date",
        },
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
    {
      id: "actions",
      header: () => <span className="text-right">Actions</span>,
      size: 50,
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleImpersonate(user.id)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Impersonate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBanUser(user.id, !user.banned)}>
                  {user.banned ? (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Unban
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 mr-2" />
                      Ban
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleViewSessions(user)}>
                  <Monitor className="w-4 h-4 mr-2" />
                  View All Sessions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      enableSorting: false,
      meta: {
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
  ], [handleBanUser, handleImpersonate, handleViewSessions])

  // DataTable configuration
  const config = React.useMemo<DataTableConfig<AdminUser>>(() => ({
    searchConfig: {
      placeholder: "Search users..."
    },
    enableColumnFilters: true,
    enableSorting: true,
    enableRowSelection: false,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    paginationConfig: {
      pageSizeOptions: [10, 20, 30, 50],
      defaultPageSize: 10,
    },
    resizingConfig: {
      enableColumnResizing: true,
    },
  }), [])

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0">
        {/* User Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">Total Users</h3>
            <p className="text-2xl font-bold">{totalCount || 0}</p>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">Active Users</h3>
            <p className="text-2xl font-bold">
              {data?.filter(user => !user.banned).length || 0}
            </p>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">Banned Users</h3>
            <p className="text-2xl font-bold">
              {data?.filter(user => user.banned).length || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <DataTable
          columns={columns}
          data={data}
          config={config}
          totalCount={totalCount}
          onStateChange={onStateChange}
          currentFilters={currentFilters}
          isLoading={isLoading}
          isFetching={isFetching}
          getRowIdProp={(row) => row.id}
        />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:w-[540px] flex flex-col gap-0">
          <SheetHeader className="shrink-0 px-6 py-6 border-b">
            <SheetTitle>
              {selectedUser ? `${selectedUser.name || selectedUser.email}'s Sessions` : 'User Sessions'}
              {!sessionsLoading && userSessions.length > 0 && ` (${userSessions.length})`}
            </SheetTitle>
            <SheetDescription>
              View and manage all active sessions for this user.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              {sessionsLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : userSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active sessions found
                </div>
              ) : (
                <div className="space-y-4">
                  {userSessions.map((session) => (
                    <div key={session.token} className="border rounded-lg p-4 space-y-3">
                      <div className="grid gap-2 flex-1">
                        <div className="grid gap-1">
                          <div className="text-sm font-medium">Session Token</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {session.token ? session.token.substring(0, 16) + '...' : 'Unknown'}
                          </div>
                        </div>

                        <div className="grid gap-1">
                          <div className="text-sm font-medium">Created</div>
                          <div className="text-sm text-muted-foreground">
                            {session.createdAt ? new Date(session.createdAt).toLocaleString() : 'Unknown'}
                          </div>
                        </div>

                        {session.expiresAt && (
                          <div className="grid gap-1">
                            <div className="text-sm font-medium">Expires</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(session.expiresAt).toLocaleString()}
                            </div>
                          </div>
                        )}

                        {session.userAgent && (
                          <div className="grid gap-1">
                            <div className="text-sm font-medium">Device</div>
                            <div className="text-sm text-muted-foreground">
                              {session.userAgent}
                            </div>
                          </div>
                        )}

                        {session.ipAddress && (
                          <div className="grid gap-1">
                            <div className="text-sm font-medium">IP Address</div>
                            <div className="text-sm text-muted-foreground">
                              {session.ipAddress}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSession(session.token)}
                        className="w-full"
                      >
                        Revoke session
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 px-6 py-4 border-t bg-background">
            <Button
              variant="destructive"
              onClick={() => selectedUser && handleRevokeUserSessions(selectedUser.id)}
              disabled={sessionsLoading || userSessions.length === 0}
              className="w-full"
            >
              Revoke All Sessions
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}