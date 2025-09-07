import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { PageHeader } from '@/components/page-header'
import { useLoadingItems } from '@/lib/hooks/use-loading-state'
import { DataTable, DataTableHeader, useTableQuery, DataTableConfig, DataTableColumnMeta } from '@/components/taali-ui/data-table'
import { 
  getTeamMembersTable,
  inviteTeamMember, 
  removeTeamMember, 
  updateTeamMemberRole, 
  cancelTeamInvitation,
  type TeamMember 
} from '@/features/teams/lib/teams.server'
import { toast } from 'sonner'
import { 
  UserPlus, 
  Mail, 
  Trash2, 
  Crown, 
  Shield, 
  User as UserIcon, 
  Eye,
  MoreHorizontal,
  Clock
} from 'lucide-react'
import { Button } from '@/components/taali-ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/taali-ui/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/taali-ui/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/taali-ui/ui/dropdown-menu'
import { Badge } from '@/components/taali-ui/ui/badge'
import { Input } from '@/components/taali-ui/ui/input'

export const Route = createFileRoute('/_authenticated/teams')({
  component: Teams,
})

function Teams() {
  const { activeOrganizationId } = useActiveOrganization()
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteRole, setInviteRole] = React.useState<'viewer' | 'member' | 'admin'>('member')
  const [inviteLoading, setInviteLoading] = React.useState(false)
  
  // Loading states for individual member actions
  const { isLoading: isLoadingMember, startLoading: startMemberLoading, stopLoading: stopMemberLoading, loadingItems: loadingMembers } = useLoadingItems<string>()

  // Use the table query hook
  const {
    data,
    totalCount,
    isLoading,
    isFetching,
    onStateChange,
    refetch,
  } = useTableQuery<TeamMember>({
    queryKey: activeOrganizationId ? ['teams', 'table', activeOrganizationId] : [],
    queryFn: (params) => {
      return getTeamMembersTable({ 
        data: { 
          organizationId: activeOrganizationId || '', 
          ...params 
        } 
      })
    },
    enabled: !!activeOrganizationId,
  })

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setInviteLoading(true)
    try {
      await inviteTeamMember({
        data: {
          organizationId: activeOrganizationId || '',
          email: inviteEmail,
          role: inviteRole
        }
      })

      toast.success('Invitation sent!')
      setInviteEmail('')
      setInviteRole('member')
      setIsInviteDialogOpen(false)
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  // Reset form when dialog closes
  const handleDialogChange = (open: boolean) => {
    setIsInviteDialogOpen(open)
    if (!open) {
      setInviteEmail('')
      setInviteRole('member')
    }
  }


  const handleRemoveMember = React.useCallback(async (memberId: string, memberName: string) => {
    const confirmed = confirm(`Are you sure you want to remove ${memberName} from this workspace?`)
    if (!confirmed) return

    startMemberLoading(memberId)
    try {
      await removeTeamMember({
        data: {
          organizationId: activeOrganizationId || '',
          memberIdOrEmail: memberId
        }
      })

      toast.success('Member removed')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member')
    } finally {
      stopMemberLoading(memberId)
    }
  }, [activeOrganizationId, startMemberLoading, stopMemberLoading, refetch])

  const handleUpdateRole = React.useCallback(async (memberId: string, newRole: 'viewer' | 'member' | 'admin' | 'owner') => {
    startMemberLoading(memberId)
    try {
      await updateTeamMemberRole({
        data: {
          organizationId: activeOrganizationId || '',
          memberId,
          role: newRole
        }
      })

      toast.success('Role updated')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role')
    } finally {
      stopMemberLoading(memberId)
    }
  }, [activeOrganizationId, startMemberLoading, stopMemberLoading, refetch])

  const handleCancelInvitation = React.useCallback(async (invitationId: string) => {
    const confirmed = confirm('Are you sure you want to cancel this invitation?')
    if (!confirmed) return

    startMemberLoading(invitationId)
    try {
      await cancelTeamInvitation({
        data: {
          organizationId: activeOrganizationId || '',
          invitationId
        }
      })

      toast.success('Invitation cancelled')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel invitation')
    } finally {
      stopMemberLoading(invitationId)
    }
  }, [activeOrganizationId, startMemberLoading, stopMemberLoading, refetch])

  const getRoleIcon = React.useCallback((role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-600" />
      case 'admin': return <Shield className="w-4 h-4 text-primary" />
      case 'viewer': return <Eye className="w-4 h-4 text-muted-foreground" />
      default: return <UserIcon className="w-4 h-4 text-muted-foreground" />
    }
  }, [])



  // Column definitions
  const columns = React.useMemo<ColumnDef<TeamMember>[]>(() => [
    {
      id: "member",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Member
        </DataTableHeader>
      ),
      enableSorting: true,
      size: 300,
      cell: ({ row }) => {
        const member = row.original
        const isLoading = isLoadingMember(member.id)
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              {member.avatar ? (
                <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
              ) : member.type === 'invitation' ? (
                <Mail className="w-4 h-4 text-muted-foreground" />
              ) : (
                <UserIcon className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <span className={`font-medium ${isLoading ? 'opacity-50' : ''}`}>
              {member.name || member.email.split('@')[0]}
            </span>
          </div>
        )
      },
      meta: {
        enableTextTruncation: true,
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "email", 
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Email
        </DataTableHeader>
      ),
      enableSorting: true,
      size: 250,
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
      enableSorting: true,
      size: 120,
      cell: ({ row }) => {
        const member = row.original
        return (
          <Badge 
            variant={member.role === 'owner' ? 'warning' : member.role === 'admin' ? 'primary' : 'muted'}
            style="soft"
            startIcon={getRoleIcon(member.role)}
          >
            {member.role}
          </Badge>
        )
      },
      meta: {
        filterConfig: {
          type: "select",
          title: "Role",
          options: [
            { label: "Owner", value: "owner" },
            { label: "Admin", value: "admin" },
            { label: "Member", value: "member" },
            { label: "Viewer", value: "viewer" },
          ],
        },
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Status
        </DataTableHeader>
      ),
      enableSorting: true,
      size: 100,
      cell: ({ row }) => {
        const member = row.original
        if (member.status === 'pending') {
          return (
            <Badge 
              variant="warning" 
              style="soft"
              startIcon={<Clock className="w-4 h-4" />}
            >
              Pending
            </Badge>
          )
        }
        return (
          <Badge 
            variant="success" 
            style="soft"
            status
          >
            Active
          </Badge>
        )
      },
      meta: {
        filterConfig: {
          type: "select",
          title: "Status",
          options: [
            { label: "Active", value: "active" },
            { label: "Pending", value: "pending" },
          ],
        },
        enableTextTruncation: false,
      } as DataTableColumnMeta,
    },
    {
      accessorKey: "joinedAt",
      header: ({ column }) => (
        <DataTableHeader column={column} sortable>
          Joined/Expires
        </DataTableHeader>
      ),
      enableSorting: true,
      size: 150,
      cell: ({ row }) => {
        const member = row.original
        if (member.joinedAt) {
          return (
            <span className="text-sm text-muted-foreground">
              {new Date(member.joinedAt).toLocaleDateString()}
            </span>
          )
        } else if (member.expiresAt) {
          return (
            <span className="text-sm text-muted-foreground">
              Expires {new Date(member.expiresAt).toLocaleDateString()}
            </span>
          )
        }
        return <span className="text-sm text-muted-foreground">-</span>
      },
      meta: {
        filterConfig: {
          type: "date",
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
        const member = row.original
        const isLoading = isLoadingMember(member.id)
        
        if (member.role === 'owner') {
          return (
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Owner</span>
            </div>
          )
        }

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isLoading}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {member.type === 'member' ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleUpdateRole(member.id, 'viewer')}
                      disabled={member.role === 'viewer' || isLoading}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Set as Viewer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleUpdateRole(member.id, 'member')}
                      disabled={member.role === 'member' || isLoading}
                    >
                      <UserIcon className="w-4 h-4 mr-2" />
                      Set as Member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleUpdateRole(member.id, 'admin')}
                      disabled={member.role === 'admin' || isLoading}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Set as Admin
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                      disabled={isLoading}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove Member
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => handleCancelInvitation(member.id)}
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cancel Invitation
                  </DropdownMenuItem>
                )}
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
  ], [getRoleIcon, isLoadingMember, handleUpdateRole, handleRemoveMember, handleCancelInvitation])

  // DataTable configuration
  const config = React.useMemo<DataTableConfig<TeamMember>>(() => ({
    searchConfig: {
      placeholder: "Search members..."
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

  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="font-semibold">Team</span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">
            Please select an organization to view team members.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <PageHeader
        title="Team"
        actions={
          <Button onClick={() => setIsInviteDialogOpen(true)}>
            <UserPlus className="w-4 h-4" />
            Invite Member
          </Button>
        }
      />

      {/* Main Content */}
      <div className="flex-1 p-6">
        <DataTable
          columns={columns}
          data={data}
          config={config}
          totalCount={totalCount}
          onStateChange={onStateChange}
          isLoading={isLoading}
          isFetching={isFetching}
          loadingRows={loadingMembers}
          getRowIdProp={(row) => row.id}
        />
      </div>

      <Dialog open={isInviteDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your workspace. They'll receive an email with instructions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="invite-email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                  <SelectItem value="member">Member - Can create and edit</SelectItem>
                  <SelectItem value="admin">Admin - Can manage team and settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember} loading={inviteLoading}>
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}